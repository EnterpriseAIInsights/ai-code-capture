import * as vscode from 'vscode';
import { CodeTracker } from './tracker';
import { GitIntegration } from './git';
import { DatabaseService } from './database';


let tracker: CodeTracker;
let gitIntegration: GitIntegration;

export function activate(context: vscode.ExtensionContext) {
    // Read the user-configurable DB path from VS Code settings
    const config = vscode.workspace.getConfiguration('ai-code-capture');
    const dbDir: string = config.get<string>('databasePath', 'c:\\ai-code-analytics');

    // Connect to the analytics database — throws (and notifies) if not found
    try {
        DatabaseService.getInstance().initialize(dbDir);
    } catch (err: any) {
        vscode.window.showErrorMessage(
            `AI Code Capture: Database not found at "${dbDir}\\analytics.db". ` +
            `Please create it manually using the scripts in db-scripts/ and update your ` +
            `setting "ai-code-capture.databasePath" if needed.`
        );
    }

    tracker = new CodeTracker(context);
    gitIntegration = new GitIntegration(tracker);

    context.subscriptions.push(tracker);
    context.subscriptions.push(gitIntegration);
}


export function deactivate() {
    // Close the DB connection cleanly before the extension host shuts down
    DatabaseService.getInstance().dispose();
}
