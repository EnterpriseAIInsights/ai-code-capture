import * as vscode from 'vscode';
import { CodeTracker } from './tracker';
import { GitIntegration } from './git';

let tracker: CodeTracker;
let gitIntegration: GitIntegration;

export function activate(context: vscode.ExtensionContext) {
	console.log('AI Code Capture Active');
    tracker = new CodeTracker(context);
    gitIntegration = new GitIntegration(tracker);

    context.subscriptions.push(tracker);
    context.subscriptions.push(gitIntegration);
}

export function deactivate() {
    if (tracker) {
        tracker.dispose();
    }
    if (gitIntegration) {
        gitIntegration.dispose();
    }
}
