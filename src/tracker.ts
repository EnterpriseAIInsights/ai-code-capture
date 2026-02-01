import * as vscode from 'vscode';

export class CodeTracker {
    private disposables: vscode.Disposable[] = [];
    private context: vscode.ExtensionContext;
    private stats: Record<string, { humanLines: number; aiLines: number }> = {};

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadState();
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.onDocumentChange.bind(this))
        );
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
            // Undo/Redo are human actions
            console.log('Human Event: Undo/Redo');
            return;
        }

        for (const change of event.contentChanges) {
            if (change.text.length > 0) {
                // Insertion
                await this.analyzeInsertion(event.document, change.text);
            } else {
                // Deletion
                console.log('Human Event: Deletion');
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
            // Typing
            this.stats[filePath].humanLines += newLines; // 0
            console.log('Human Event: Typing');
            return;
        }

        if (text.length > 10) {
            const clipboardText = await vscode.env.clipboard.readText();
            if (text === clipboardText) {
                this.stats[filePath].humanLines += newLines;
                console.log(`Human Event: Paste (${newLines} lines)`);
            } else {
                this.stats[filePath].aiLines += newLines;
                console.log(`AI Event: Bulk Insert (${newLines} lines)`);
            }
        } else {
             this.stats[filePath].humanLines += newLines;
             console.log('Human Event: Typing');
        }

        this.saveState();
    }

    // Get the stats
    public getStats() {
        return this.stats;
    }

    // Dispose the tracker
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
