import * as vscode from 'vscode';
import { CodeTracker } from './tracker';

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

        const stats = this.tracker.getStats();
        let totalHuman = 0;
        let totalAI = 0;

        for (const file in stats) {
           totalHuman += stats[file].humanLines;
           totalAI += stats[file].aiLines;
        }

        const total = totalHuman + totalAI;
        const humanPct = total > 0 ? ((totalHuman / total) * 100).toFixed(1) : '0.0';
        const aiPct = total > 0 ? ((totalAI / total) * 100).toFixed(1) : '0.0';

        let userName = 'Unknown';
        try {
            const config = await repo.getConfig('user.name');
             if (config) {
                 userName = config;
             }
        } catch (e) {
             console.error('Failed to get git user name', e);
        }

        // Display the report
        const message = `Code Capture: Pushed by ${userName}. Human: ${humanPct}% (${totalHuman} lines), AI: ${aiPct}% (${totalAI} lines)`;
        vscode.window.showInformationMessage(message);

        // Reset counters for the next push cycle
        await this.tracker.resetStats();
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
