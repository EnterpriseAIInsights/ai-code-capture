import * as vscode from 'vscode';

interface FileStat {
    humanLines: number;
    aiLines: number;
    aiSessions: number;       // number of distinct AI insertion bursts
    largestAiBlock: number;   // largest single AI-inserted chunk (lines)
}

export class CodeTracker {
    private disposables: vscode.Disposable[] = [];
    private context: vscode.ExtensionContext;
    private stats: Record<string, FileStat> = {};
    private statusBar: vscode.StatusBarItem;
    private sessionStart: number = Date.now();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.tooltip = 'AI Code Capture: Human vs AI line contributions';
        this.statusBar.show();
        this.loadState();
        this.updateStatusBar();
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.onDocumentChange.bind(this))
        );
    }

    private updateStatusBar() {
        let totalHuman = 0;
        let totalAI = 0;
        for (const file in this.stats) {
            totalHuman += this.stats[file].humanLines;
            totalAI += this.stats[file].aiLines;
        }
        this.statusBar.text = `$(person) ${totalHuman}L  $(robot) ${totalAI}L`;
    }

    // Load the state from the workspace state
    private loadState() {
        this.stats = this.context.workspaceState.get('ai-code-capture.stats') || {};
    }

    // Save the state to the workspace state
    private async saveState() {
        await this.context.workspaceState.update('ai-code-capture.stats', this.stats);
    }

    // Handle document changes
    private async onDocumentChange(event: vscode.TextDocumentChangeEvent) {
        if (event.document.uri.scheme !== 'file') {
            return;
        }

        if (event.reason === vscode.TextDocumentChangeReason.Undo || event.reason === vscode.TextDocumentChangeReason.Redo) {
            return;
        }

        for (const change of event.contentChanges) {
            if (change.text.length > 0) {
                await this.analyzeInsertion(event.document, change.text);
            }
        }
    }

    // Analyze the insertion
    private async analyzeInsertion(document: vscode.TextDocument, text: string) {
        const filePath = document.uri.fsPath;
        if (!this.stats[filePath]) {
            this.stats[filePath] = { humanLines: 0, aiLines: 0, aiSessions: 0, largestAiBlock: 0 };
        }

        const newLines = (text.match(/\n/g) || []).length;
        if (newLines === 0 && text.length < 50) {
            // single-character human keypress — no new lines, ignore
            return;
        }

        if (text.length > 10) {
            const clipboardText = await vscode.env.clipboard.readText();
            if (text === clipboardText) {
                // Human paste
                this.stats[filePath].humanLines += newLines;
            } else {
                // AI insertion: track session count and largest block
                this.stats[filePath].aiLines += newLines;
                this.stats[filePath].aiSessions += 1;
                if (newLines > this.stats[filePath].largestAiBlock) {
                    this.stats[filePath].largestAiBlock = newLines;
                }
            }
        } else {
            this.stats[filePath].humanLines += newLines;
        }

        this.saveState();
        this.updateStatusBar();
    }

    // Get the stats
    public getStats(): Record<string, FileStat> {
        return this.stats;
    }

    /**
     * Returns the number of minutes elapsed since the session (first edit or
     * last reset) began — used by GitIntegration for analytics.
     */
    public getSessionDurationMins(): number {
        return (Date.now() - this.sessionStart) / 60_000;
    }

    // Reset stats after a push
    public async resetStats() {
        this.stats = {};
        this.sessionStart = Date.now(); // start a fresh session timer
        await this.saveState();
        this.updateStatusBar();
    }

    // Dispose the tracker
    public dispose() {
        this.statusBar.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
