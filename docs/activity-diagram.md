# AI Code Capture — Activity Diagram

# AI Code Capture — Detailed Activity Diagram

```mermaid
flowchart TD
    classDef start       fill:#1e3a5f,stroke:#4a90d9,color:#ffffff,font-weight:bold
    classDef process     fill:#1a4731,stroke:#4caf50,color:#ffffff
    classDef decision    fill:#4a3000,stroke:#ffa726,color:#ffffff,font-weight:bold
    classDef human       fill:#1a3a5c,stroke:#42a5f5,color:#ffffff
    classDef ai          fill:#3a1a1a,stroke:#ef5350,color:#ffffff
    classDef git         fill:#2e1a47,stroke:#ab47bc,color:#ffffff
    classDef stop        fill:#2a2a2a,stroke:#888888,color:#cccccc

    A([VS Code Starts]):::start
    B[activate — extension.ts\nCreate CodeTracker\nCreate GitIntegration]:::process
    C[CodeTracker: loadState\nRestore stats from workspaceState]:::process
    D[Listen: onDidChangeTextDocument]:::process
    E[GitIntegration: initialize\nGet vscode.git extension]:::git

    F{Git extension\nfound?}:::decision
    G[Wait for onDidOpenRepository]:::git
    H[setupRepositories\nListen: onDidRunOperation]:::git

    I{{Document Change Event}}:::process
    J{URI scheme\n= 'file'?}:::decision
    K([Ignore — not a file]):::stop
    L{Undo or\nRedo?}:::decision
    M[Log: Human Event Undo/Redo\nNo stat update]:::human

    N{change.text\nlength > 0?}:::decision
    O[Log: Human Event Deletion\nNo stat update]:::human
    P[analyzeInsertion]:::process

    Q{newLines = 0\nAND length < 50?}:::decision
    R[Log: Human Event Typing\nhumanLines += 0]:::human

    S{length > 10?}:::decision
    T[Log: Human Event Typing\nhumanLines += newLines]:::human

    U[Read clipboard text]:::process
    V{text ==\nclipboard?}:::decision
    W[Human Event: Paste\nhumanLines += newLines]:::human
    X[AI Event: Bulk Insert\naiLines += newLines]:::ai

    Y[saveState → workspaceState]:::process

    Z{{Git Push Operation}}:::git
    AA[handlePush\ngetStats from CodeTracker]:::git
    AB{total lines\n= 0?}:::decision
    AC([Skip — nothing to report]):::stop
    AD[Calculate humanPct & aiPct\nGet git user.name]:::git
    AE[Show Info Message\nHuman X% · AI Y%]:::git

    AF([deactivate\nDispose tracker & git]):::stop

    A --> B
    B --> C
    C --> D
    B --> E
    E --> F
    F -- No --> G
    F -- Yes --> H
    G --> H

    D --> I
    I --> J
    J -- No --> K
    J -- Yes --> L
    L -- Yes --> M
    L -- No --> N
    N -- No --> O
    N -- Yes --> P

    P --> Q
    Q -- Yes --> R
    Q -- No --> S
    S -- No --> T
    S -- Yes --> U
    U --> V
    V -- Yes --> W
    V -- No --> X
    W --> Y
    X --> Y
    T --> Y

    H --> Z
    Z --> AA
    AA --> AB
    AB -- Yes --> AC
    AB -- No --> AD
    AD --> AE

    B -.->|on deactivate| AF
```

## Logic Summary

### Extension Activation (`extension.ts`)
- Creates a `CodeTracker` and `GitIntegration` instance, both registered as disposables.

### CodeTracker (`tracker.ts`)
- **loadState** — restores per-file `{ humanLines, aiLines }` stats from `workspaceState` on startup.
- **onDocumentChange** — fires on every text document change:
  - Skips non-file URIs (output panels, virtual docs).
  - Treats Undo/Redo as human actions (no stat change).
  - Deletions are logged as human events.
  - Insertions are forwarded to `analyzeInsertion`.
- **analyzeInsertion** — classifies inserted text:
  | Condition | Classification |
  |---|---|
  | 0 newlines AND < 50 chars | Human — Typing |
  | ≤ 10 chars | Human — Typing |
  | > 10 chars AND matches clipboard | Human — Paste |
  | > 10 chars AND does NOT match clipboard | **AI — Bulk Insert** |
- Persists updated stats to `workspaceState` after each insertion.

### GitIntegration (`git.ts`)
- Hooks into the built-in `vscode.git` extension.
- Listens for `Push` operations on every repository.
- On push, aggregates totals across all tracked files and shows an information message:
  > `Code Capture: Pushed by <user>. Human: X% (N lines), AI: Y% (M lines)`
```
