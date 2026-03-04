import * as vscode from 'vscode';

export class CodeTracker {
    private disposables: vscode.Disposable[] = [];
    private context: vscode.ExtensionContext;
    private stats: Record<string, { humanLines: number; aiLines: number }> = {};
    private statusBar: vscode.StatusBarItem;

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
        // Ignore changes to output channels or log files if possible
        if (event.document.uri.scheme !== 'file') {
            return;
        }

        // Handle Undo/Redo
        if (event.reason === vscode.TextDocumentChangeReason.Undo || event.reason === vscode.TextDocumentChangeReason.Redo) {
            return;
        }

        for (const change of event.contentChanges) {
            if (change.text.length > 0) {
                // Insertion
                await this.analyzeInsertion(event.document, change.text);
            }
        }
    }

    // Analyze the insertion
    private async analyzeInsertion(document: vscode.TextDocument, text: string) {
        const filePath = document.uri.fsPath;
        if (!this.stats[filePath]) {
            this.stats[filePath] = { humanLines: 0, aiLines: 0 };
        }

        const newLines = (text.match(/\n/g) || []).length;
        if (newLines === 0 && text.length < 50) {
            this.stats[filePath].humanLines += newLines; // 0
            return;
        }

        if (text.length > 10) {
            const clipboardText = await vscode.env.clipboard.readText();
            if (text === clipboardText) {
                this.stats[filePath].humanLines += newLines;
            } else {
                this.stats[filePath].aiLines += newLines;
            }
        } else {
             this.stats[filePath].humanLines += newLines;
        }

        this.saveState();
        this.updateStatusBar();
    }

    // Get the stats
    public getStats() {
        return this.stats;
    }

    // Reset stats after a push
    public async resetStats() {
        this.stats = {};
        await this.saveState();
        this.updateStatusBar();
    }

    // Dispose the tracker
    public dispose() {
        this.statusBar.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
