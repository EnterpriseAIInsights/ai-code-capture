import * as vscode from 'vscode';
import { CodeTracker } from './tracker';

export class GitIntegration {
    private tracker: CodeTracker;
    private disposables: vscode.Disposable[] = [];

    constructor(tracker: CodeTracker) {
        this.tracker = tracker;
        this.initialize();
    }

    private async initialize() {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            console.log('Git extension not found');
            return;
        }

        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            console.log('Git API not available');
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
            this.disposables.push(repo.onDidRunOperation(async (op: any) => {
                const kind = op.operation?.kind ?? op.operation;
                console.log('Git operation:', kind);
                if (kind === 'Push') {
                    await this.handlePush(repo);
                }
            }));
        }
    }

    private async handlePush(repo: any) {
        const stats = this.tracker.getStats();
        let totalHuman = 0;
        let totalAI = 0;

        for (const file in stats) {
           totalHuman += stats[file].humanLines;
           totalAI += stats[file].aiLines;
        }

        const total = totalHuman + totalAI;
        if (total === 0) {
            return;
        }

        const humanPct = ((totalHuman / total) * 100).toFixed(1);
        const aiPct = ((totalAI / total) * 100).toFixed(1);

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
        console.log(message);
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
