import * as vscode from 'vscode';
import * as path from 'path';
import { CodeTracker } from './tracker';
import { DatabaseService, CommitMetrics } from './database';

export class GitIntegration {
    private tracker: CodeTracker;
    private disposables: vscode.Disposable[] = [];
    private lastPushTime: number = 0;
    private readonly PUSH_DEBOUNCE_MS = 2000;

    constructor(tracker: CodeTracker) {
        this.tracker = tracker;
        this.initialize();
    }

    private async initialize() {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            return;
        }

        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            return;
        }

        if (git.repositories.length > 0) {
            this.setupRepositories(git.repositories);
        } else {
            git.onDidOpenRepository((repo: any) => {
                this.setupRepositories([repo]);
            });
        }
    }

    private setupRepositories(repositories: any[]) {
        for (const repo of repositories) {
            // VS Code Git UI push detection
            this.disposables.push(repo.onDidRunOperation(async (op: any) => {
                const kind = op.operation?.kind ?? op.operation;
                if (kind === 'Push') {
                    await this.handlePush(repo);
                }
            }));

            // Terminal push detection via remote refs file watcher
            this.setupTerminalPushWatcher(repo);
        }
    }

    private setupTerminalPushWatcher(repo: any) {
        // Watch individual ref files (unpacked refs)
        const refsWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(repo.rootUri, '.git/refs/remotes/**')
        );
        this.disposables.push(refsWatcher.onDidChange(async () => {
            await this.handlePush(repo);
        }));
        this.disposables.push(refsWatcher.onDidCreate(async () => {
            await this.handlePush(repo);
        }));
        this.disposables.push(refsWatcher);

        // Watch packed-refs (modern git stores refs here after gc)
        const packedRefsWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(repo.rootUri, '.git/packed-refs')
        );
        this.disposables.push(packedRefsWatcher.onDidChange(async () => {
            await this.handlePush(repo);
        }));
        this.disposables.push(packedRefsWatcher);
    }

    private async handlePush(repo: any) {
        const now = Date.now();
        if (now - this.lastPushTime < this.PUSH_DEBOUNCE_MS) {
            return;
        }
        this.lastPushTime = now;

        // ── 1. Aggregate human/AI line counts from tracker ─────────────────
        const stats = this.tracker.getStats();
        let totalHuman = 0;
        let totalAI = 0;
        let aiSessionsCount = 0;
        let largestAiBlock = 0;

        const filesList: string[] = [];
        for (const file in stats) {
            const fileStat = stats[file];
            totalHuman += fileStat.humanLines;
            totalAI    += fileStat.aiLines;
            aiSessionsCount += fileStat.aiSessions ?? 0;
            largestAiBlock = Math.max(largestAiBlock, fileStat.largestAiBlock ?? 0);
            if (fileStat.humanLines + fileStat.aiLines > 0) {
                filesList.push(path.basename(file));
            }
        }

        const total    = totalHuman + totalAI;
        const humanPct = total > 0 ? ((totalHuman / total) * 100).toFixed(1) : '0.0';
        const aiPct    = total > 0 ? ((totalAI    / total) * 100).toFixed(1) : '0.0';

        // ── 2. Collect Git context ─────────────────────────────────────────
        let userName    = 'Unknown';
        let userEmail   = '';
        let branchName  = '';
        let commitId    = '';
        let commitMessage = '';
        let repoUrl     = '';
        let repoName    = '';

        try {
            const nameConfig  = await repo.getConfig('user.name');
            const emailConfig = await repo.getConfig('user.email');
            if (nameConfig)  { userName  = nameConfig; }
            if (emailConfig) { userEmail = emailConfig; }
        } catch (e) {
            console.error('[AI Code Capture] Failed to get git user config', e);
        }

        try {
            const head = repo.state?.HEAD;
            if (head) {
                branchName = head.name ?? '';
                commitId   = head.commit ?? '';
            }
        } catch (e) {
            console.error('[AI Code Capture] Failed to get HEAD info', e);
        }

        try {
            const remotes = repo.state?.remotes ?? [];
            if (remotes.length > 0) {
                repoUrl  = remotes[0].fetchUrl ?? remotes[0].pushUrl ?? '';
                repoName = this.extractRepoName(repoUrl);
            }
        } catch (e) {
            console.error('[AI Code Capture] Failed to get remote info', e);
        }

        try {
            // Read the last commit message via git log
            const log = await repo.log({ maxEntries: 1 });
            if (log && log.length > 0) {
                commitMessage = log[0].message ?? '';
            }
        } catch (e) {
            // Non-fatal — commit message is optional
        }

        // ── 3. Workspace context ───────────────────────────────────────────
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceId = workspaceFolders?.[0]?.name ?? 'unknown';
        const projectLanguage = this.detectDominantLanguage(filesList);

        // ── 4. AI confidence heuristic ─────────────────────────────────────
        const aiConfidenceScore = total > 0
            ? parseFloat((totalAI / total).toFixed(2))
            : 0.0;

        // ── 5. Session duration ────────────────────────────────────────────
        const sessionDurationMins = this.tracker.getSessionDurationMins();

        // ── 6. Build metrics object ────────────────────────────────────────
        const metrics: CommitMetrics = {
            commitId,
            userName,
            userEmail,
            branchName,
            repoName,
            repoUrl,
            humanLinesAdded:    totalHuman,
            aiLinesAdded:       totalAI,
            filesChanged:       filesList.length,
            filesList,
            commitMessage,
            aiToolDetected:     this.detectAiTool(),
            aiConfidenceScore,
            aiSessionsCount,
            largestAiBlock,
            sessionDurationMins,
            workspaceId,
            projectLanguage,
        };

        // ── 7. Persist to SQLite ───────────────────────────────────────────
        DatabaseService.getInstance().insertCommitMetrics(metrics);

        // ── 8. Show notification ───────────────────────────────────────────
        const message = `AI Code Capture | Pushed by ${userName} | Human: ${humanPct}% (${totalHuman} lines) | AI: ${aiPct}% (${totalAI} lines)`;
        vscode.window.showInformationMessage(message);

        // ── 9. Reset counters for the next push cycle ──────────────────────
        await this.tracker.resetStats();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Extracts "org/repo" or "repo" from a Git remote URL */
    private extractRepoName(url: string): string {
        if (!url) { return ''; }
        // Handles: https://github.com/org/repo.git  OR  git@github.com:org/repo.git
        const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
        return match ? match[1] : url;
    }

    /** Guesses the dominant language from touched file extensions */
    private detectDominantLanguage(files: string[]): string {
        const freq: Record<string, number> = {};
        for (const f of files) {
            const ext = path.extname(f).replace('.', '').toLowerCase();
            if (ext) { freq[ext] = (freq[ext] ?? 0) + 1; }
        }
        return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    }

    /** Detects AI tool based on active VS Code extensions */
    private detectAiTool(): string {
        if (vscode.extensions.getExtension('GitHub.copilot')) { return 'Copilot'; }
        if (vscode.extensions.getExtension('anysphere.cursor-always-local')) { return 'Cursor'; }
        if (vscode.extensions.getExtension('Google.geminicodeassist')) { return 'Gemini'; }
        return 'Unknown';
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
