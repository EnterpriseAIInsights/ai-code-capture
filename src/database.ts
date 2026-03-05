import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommitMetrics {
    // Git identity
    commitId: string;
    userName: string;
    userEmail: string;
    branchName: string;

    // Repository context
    repoName: string;
    repoUrl: string;

    // Code volume (raw counts from tracker)
    humanLinesAdded: number;
    aiLinesAdded: number;

    // Commit scope
    filesChanged: number;
    filesList: string[];       // will be JSON-serialised on insert
    commitMessage: string;

    // AI attribution detail
    aiToolDetected: string;    // e.g. "Copilot", "Cursor"
    aiConfidenceScore: number; // 0.0–1.0
    aiSessionsCount: number;   // distinct AI burst count
    largestAiBlock: number;    // max consecutive AI lines

    // Session & productivity
    sessionDurationMins: number;
    workspaceId: string;
    projectLanguage: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class DatabaseService {

    private static instance: DatabaseService | null = null;
    private db: Database | null = null;
    private dbPath: string | null = null;

    // ── Singleton ──────────────────────────────────────────────────────────
    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private constructor() { /* use getInstance() */ }

    // ── Initialisation ─────────────────────────────────────────────────────
    /**
     * Loads the SQLite database into memory via sql.js (pure WASM — no native
     * compilation required). Must be awaited once during extension activation.
     *
     * @param dbDir  Directory where analytics.db lives (e.g. "c:\ai-code-analytics")
     */
    public async initialize(dbDir: string = 'c:\\ai-code-analytics'): Promise<void> {
        if (this.db) {
            return; // already initialised
        }

        const dbPath = path.join(dbDir, 'analytics.db');

        // Fail fast — database must be created manually before use
        if (!fs.existsSync(dbPath)) {
            const msg = `[AI Code Capture] Database not found at: ${dbPath}. Please create it manually using the scripts in db-scripts/.`;
            console.error(msg);
            throw new Error(msg);
        }

        // Locate the WASM file bundled alongside sql.js
        const sqlJsDistDir = path.dirname(require.resolve('sql.js/dist/sql-wasm.js'));
        const SQL = await initSqlJs({
            locateFile: (filename: string) => path.join(sqlJsDistDir, filename),
        });

        const fileBuffer = fs.readFileSync(dbPath);
        this.db = new SQL.Database(fileBuffer);
        this.dbPath = dbPath;

        console.log(`[AI Code Capture] Database connected at: ${dbPath}`);
    }

    // ── Persist to disk ────────────────────────────────────────────────────
    private saveToFile(): void {
        if (!this.db || !this.dbPath) { return; }
        const data = this.db.export();
        fs.writeFileSync(this.dbPath, Buffer.from(data));
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    /**
     * Persists a single commit's metrics to the database.
     * All computed/derived fields are calculated here automatically.
     */
    public insertCommitMetrics(metrics: CommitMetrics): void {
        console.log(`[AI Code Capture] insertCommitMetrics called — db ready: ${!!this.db}`);
        if (!this.db) {
            console.error('[AI Code Capture] DatabaseService not initialised. Call initialize() first.');
            return;
        }

        const now = new Date();
        const total = metrics.humanLinesAdded + metrics.aiLinesAdded;
        const aiPct  = total > 0 ? (metrics.aiLinesAdded  / total) * 100 : 0;
        const humPct = total > 0 ? (metrics.humanLinesAdded / total) * 100 : 0;

        try {
            this.db.run(`
                INSERT INTO commit_metrics (
                    commit_id, user_name, user_email, branch_name,
                    repo_name, repo_url,
                    human_lines_added, ai_lines_added, total_lines_added,
                    ai_contribution_pct, human_contribution_pct,
                    files_changed, files_list, commit_message,
                    ai_tool_detected, ai_confidence_score, ai_sessions_count, largest_ai_block,
                    session_duration_mins, workspace_id, project_language,
                    day_of_week, hour_of_day, pushed_at
                ) VALUES (
                    :commitId, :userName, :userEmail, :branchName,
                    :repoName, :repoUrl,
                    :humanLinesAdded, :aiLinesAdded, :totalLinesAdded,
                    :aiContributionPct, :humanContributionPct,
                    :filesChanged, :filesList, :commitMessage,
                    :aiToolDetected, :aiConfidenceScore, :aiSessionsCount, :largestAiBlock,
                    :sessionDurationMins, :workspaceId, :projectLanguage,
                    :dayOfWeek, :hourOfDay, :pushedAt
                )
            `, {
                ':commitId':            metrics.commitId,
                ':userName':            metrics.userName,
                ':userEmail':           metrics.userEmail,
                ':branchName':          metrics.branchName,
                ':repoName':            metrics.repoName,
                ':repoUrl':             metrics.repoUrl,
                ':humanLinesAdded':     metrics.humanLinesAdded,
                ':aiLinesAdded':        metrics.aiLinesAdded,
                ':totalLinesAdded':     total,
                ':aiContributionPct':   parseFloat(aiPct.toFixed(2)),
                ':humanContributionPct': parseFloat(humPct.toFixed(2)),
                ':filesChanged':        metrics.filesChanged,
                ':filesList':           JSON.stringify(metrics.filesList),
                ':commitMessage':       metrics.commitMessage,
                ':aiToolDetected':      metrics.aiToolDetected,
                ':aiConfidenceScore':   metrics.aiConfidenceScore,
                ':aiSessionsCount':     metrics.aiSessionsCount,
                ':largestAiBlock':      metrics.largestAiBlock,
                ':sessionDurationMins': parseFloat(metrics.sessionDurationMins.toFixed(2)),
                ':workspaceId':         metrics.workspaceId,
                ':projectLanguage':     metrics.projectLanguage,
                ':dayOfWeek':           now.getDay(),
                ':hourOfDay':           now.getHours(),
                ':pushedAt':            now.toISOString(),
            });

            this.saveToFile();
            console.log(`[AI Code Capture] Metrics recorded for commit ${metrics.commitId.substring(0, 8)}`);
        } catch (err) {
            console.error('[AI Code Capture] Failed to insert commit metrics:', err);
        }
    }

    // ── Dispose ────────────────────────────────────────────────────────────
    /**
     * Closes the database. Call from extension deactivate().
     */
    public dispose(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.dbPath = null;
            DatabaseService.instance = null;
            console.log('[AI Code Capture] Database connection closed.');
        }
    }
}
