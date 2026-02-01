# Implementation Plan: AI Code Capture

## Overview

An automated tracking system for VS Code to quantify Human vs. AI code contributions.

## Goals

Accurately identify and report:

1.  Lines written by Developer.
2.  Lines written by AI.
3.  Total lines.
4.  AI Contribution %.
5.  Human Contribution %.
6.  User Identity (who pushed the code).

## Technical Approach

### 1. Detection Mechanism

We will build a VS Code Extension using TypeScript that listens to document changes in real-time.

- **Human Events**: Keypresses, single character insertions, `Undo`/`Redo` events, clipboard events like pasting.
- **AI Events**: Rapid bulk code insertions, file system writes by external processes (Agentic AI), specific "Apply" commands from Cursor (if detectable via API or heuristics).

### 2. Data Storage

- Metrics will be persisted in the Workspace State to survive reloads.
- Data structure: `Map<FileName, { humanAdded: number, aiAdded: number }>`

### 3. Git Integration

- Utilizing `vscode.git` extension API.
- Trigger: Detect `Push` operation.
- Action: Compute metrics for the project and display a summary notification/output.
- Context: Capture Git User (name/email) from configuration.

## Roadmap

1.  **Setup**: Initialize Extension project.
2.  **Core Logic**: Implement the Change Listener and Heuristic Engine.
3.  **Git Hook**: Connect to Git Push events.
4.  **UI/Reporting**: Display the final stats.
