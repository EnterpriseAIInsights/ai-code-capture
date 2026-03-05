# AI Code Capture

**AI Code Capture** is a VS Code extension designed to automatically track and report the ratio of Human vs. AI-generated code contributions in your project. It listens to document changes in real-time and persists metrics, providing insights into authorship.

## Summary Flow

```mermaid
flowchart TD
    classDef start   fill:#1e3a5f,stroke:#4a90d9,color:#ffffff,font-weight:bold
    classDef track   fill:#1a4731,stroke:#4caf50,color:#ffffff
    classDef classify fill:#4a3000,stroke:#ffa726,color:#ffffff,font-weight:bold
    classDef human   fill:#1a3a5c,stroke:#42a5f5,color:#ffffff
    classDef ai      fill:#3a1a1a,stroke:#ef5350,color:#ffffff
    classDef git     fill:#2e1a47,stroke:#ab47bc,color:#ffffff
    classDef report  fill:#3a2500,stroke:#ffa726,color:#ffffff,font-weight:bold

    A([VS Code<br/>Activates]):::start
    B[Track Document<br/>Changes]:::track
    C[Classify Change<br/>Human · AI]:::classify
    D[Human Lines<br/>Typing · Paste · Undo]:::human
    E[AI Lines<br/>Bulk Insert]:::ai
    F[Persist Stats<br/>per File]:::track
    G([Git Push]):::git
    H[Aggregate<br/>Totals]:::git
    I[Show Report<br/>Human X% · AI Y%]:::report

    A --> B --> C --> D --> F
    C --> E --> F
    F --> G --> H --> I
```

## Features

### 1. Real-time Contribution Tracking

The extension differentiates between human and AI/automated inputs using a heuristic engine:

- **Human Events**:
  - **Typing**: Single character insertions.
  - **Pasting**: Content matching the current system clipboard.
  - **Undo/Redo**: Explicitly preserved as human actions.
- **AI Events**:
  - **Bulk Insertions**: Large blocks of code inserted rapidly that do _not_ match the clipboard (e.g., Code Completions, Copilot, Agentic AI writes).

### 2. Data Persistence

- In-session metrics are stored in the **Workspace State**, persisting across VS Code reloads.
- On every `git push`, metrics are written to a **SQLite database** (`analytics.db`) for long-term analytics.

### 3. Git Integration

- **Automated Reporting**: Listens for `git push` operations (both from VS Code UI and terminal).
- **Identity Capture**: Captures `user.name`, `user.email`, branch name, repo URL, and latest commit message from Git.
- **AI Tool Detection**: Identifies the active AI assistant (Copilot, Cursor, Gemini).
- **Feedback**: Displays a summary notification with:
  - User identity
  - Human contribution % (and line count)
  - AI contribution % (and line count)
- **Metrics persisted per push**: AI sessions count, largest AI block, session duration, dominant language, and workspace ID.

## Installation

1.  Download the `.vsix` release file.
2.  Open VS Code.
3.  Go to the **Extensions** view (`Ctrl+Shift+X`).
4.  Click the **...** (Views and More Actions) menu at the top of the view.
5.  Select **Install from VSIX...**.
6.  Locate and select the `ai-code-capture-0.0.1.vsix` file.
7.  Reload VS Code if prompted.

## Development Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Open the project in VS Code.

## Development

### Running the Extension

1.  Press `F5` to open a new VS Code window with the extension loaded.
2.  Open any file and start coding.

### Linting

- **Linting**: `npm run lint`

### Pre-commit Hooks

This project uses `pre-commit` to ensure code quality.

1.  Install pre-commit: `pip install pre-commit` (or equivalent).
2.  Install hooks: `pre-commit install`.
3.  Checks run automatically on commit.

## Documentation

- [Activity Diagram — Extension Logic](docs/activity-diagram.md): Full flowchart of how the extension tracks contributions, classifies insertions, and reports on git push.

## Configuration

### Database Setup (Required)

The extension writes analytics to a SQLite database that **must be created manually** before first use:

1. Run the scripts in `db-scripts/` against your SQLite database:
   ```bash
   sqlite3 analytics.db < db-scripts/001_create_commit_metrics.sql
   sqlite3 analytics.db < db-scripts/002_create_indexes.sql
   ```
2. Place `analytics.db` in a directory of your choice (default: `c:\ai-code-analytics`).

### Settings

| Setting                        | Default                | Description                               |
| ------------------------------ | ---------------------- | ----------------------------------------- |
| `ai-code-capture.databasePath` | `c:\ai-code-analytics` | Directory where `analytics.db` is located |

Update this in VS Code via **File → Preferences → Settings** and search for `AI Code Capture`.
