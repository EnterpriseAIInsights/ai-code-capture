# Implementation Plan: AI Code Capture

## Overview

An automated tracking system for VS Code to quantify Human vs. AI code contributions, with persistent analytics stored in a local SQLite database.

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

### 2. In-Memory Storage (per session)

- Metrics will be persisted in the Workspace State to survive reloads.
- Data structure: `Map<FileName, { humanAdded: number, aiAdded: number }>`

### 3. Git Integration

- Utilizing `vscode.git` extension API.
- Trigger: Detect `Push` operation.
- Action: Compute metrics for the project, display a summary notification, and write to the analytics database.
- Context: Capture Git User (name/email), commit SHA, branch name from git configuration.

### 4. Analytics Database (SQLite)

- **Location**: `c:\ai-code-analytics\analytics.db` (created automatically on first run)
- **Library**: `better-sqlite3` (synchronous, reliable, zero-config)
- **Schema scripts**: `db-scripts/` folder in the repo (versioned SQL files)
- **Module**: `src/database.ts` — singleton `DatabaseService` class

#### `commit_metrics` Table — Full Schema

| Column                   | Type       | Description                              |
| ------------------------ | ---------- | ---------------------------------------- |
| `id`                     | INTEGER PK | Auto-increment row ID                    |
| `commit_id`              | TEXT       | Full git commit SHA                      |
| `user_name`              | TEXT       | `git config user.name`                   |
| `user_email`             | TEXT       | `git config user.email`                  |
| `branch_name`            | TEXT       | Branch at time of push                   |
| `repo_name`              | TEXT       | Repository name                          |
| `repo_url`               | TEXT       | Remote origin URL                        |
| `human_lines_added`      | INTEGER    | Lines typed by human                     |
| `ai_lines_added`         | INTEGER    | Lines inserted by AI                     |
| `total_lines_added`      | INTEGER    | `human + ai`                             |
| `ai_contribution_pct`    | REAL       | `ai / total * 100`                       |
| `human_contribution_pct` | REAL       | `human / total * 100`                    |
| `files_changed`          | INTEGER    | Number of files in commit                |
| `files_list`             | TEXT       | JSON array of file paths                 |
| `commit_message`         | TEXT       | HEAD commit message                      |
| `ai_tool_detected`       | TEXT       | e.g. `"Copilot"`, `"Cursor"`             |
| `ai_confidence_score`    | REAL       | Heuristic score 0.0–1.0                  |
| `ai_sessions_count`      | INTEGER    | Distinct AI insertion bursts             |
| `largest_ai_block`       | INTEGER    | Largest single AI-inserted block (lines) |
| `session_duration_mins`  | REAL       | Time from first edit to push             |
| `workspace_id`           | TEXT       | VS Code workspace folder name            |
| `project_language`       | TEXT       | Dominant file extension                  |
| `day_of_week`            | INTEGER    | 0=Sun … 6=Sat                            |
| `hour_of_day`            | INTEGER    | 0–23                                     |
| `pushed_at`              | TEXT       | ISO 8601 timestamp                       |

#### Analytics Enabled by This Schema

- AI adoption trend over time per user/team
- AI tool attribution breakdown
- Commit productivity heatmap by day/hour
- Human vs AI ratio per repo or branch
- Session productivity (lines per active minute)

## Roadmap

1.  **Setup**: Initialize Extension project. ✅
2.  **Core Logic**: Implement the Change Listener and Heuristic Engine. ✅
3.  **Git Hook**: Connect to Git Push events. ✅
4.  **UI/Reporting**: Display the final stats. ✅
5.  **Database**: Create SQLite schema scripts and `DatabaseService` module. 🔄
6.  **Integration**: Wire `DatabaseService` into `git.ts` `handlePush()`. 🔄
