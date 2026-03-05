-- ============================================================
-- Script : 001_create_commit_metrics.sql
-- Purpose: Create the main analytics table for AI Code Capture
-- DB     : c:\ai-code-analytics\analytics.db  (SQLite)
-- ============================================================

CREATE TABLE IF NOT EXISTS commit_metrics (
    -- Primary key
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Git identity
    commit_id               TEXT    NOT NULL,
    user_name               TEXT    NOT NULL DEFAULT '',
    user_email              TEXT    NOT NULL DEFAULT '',
    branch_name             TEXT    NOT NULL DEFAULT '',

    -- Repository context
    repo_name               TEXT    NOT NULL DEFAULT '',
    repo_url                TEXT    NOT NULL DEFAULT '',

    -- Code volume
    human_lines_added       INTEGER NOT NULL DEFAULT 0,
    ai_lines_added          INTEGER NOT NULL DEFAULT 0,
    total_lines_added       INTEGER NOT NULL DEFAULT 0,   -- human + ai (computed on insert)

    -- Contribution percentages
    ai_contribution_pct     REAL    NOT NULL DEFAULT 0.0, -- ai / total * 100
    human_contribution_pct  REAL    NOT NULL DEFAULT 0.0, -- human / total * 100

    -- Commit scope
    files_changed           INTEGER NOT NULL DEFAULT 0,
    files_list              TEXT    NOT NULL DEFAULT '[]', -- JSON array of file paths
    commit_message          TEXT    NOT NULL DEFAULT '',

    -- AI attribution detail
    ai_tool_detected        TEXT    NOT NULL DEFAULT 'Unknown', -- e.g. "Copilot", "Cursor", "Gemini"
    ai_confidence_score     REAL    NOT NULL DEFAULT 0.0,  -- 0.0 to 1.0
    ai_sessions_count       INTEGER NOT NULL DEFAULT 0,    -- distinct AI burst count
    largest_ai_block        INTEGER NOT NULL DEFAULT 0,    -- max consecutive AI-inserted lines

    -- Session & productivity
    session_duration_mins   REAL    NOT NULL DEFAULT 0.0,  -- first edit to push (minutes)
    workspace_id            TEXT    NOT NULL DEFAULT '',   -- VS Code workspace folder name
    project_language        TEXT    NOT NULL DEFAULT '',   -- dominant file extension

    -- Time dimensions (for analytics grouping)
    day_of_week             INTEGER NOT NULL DEFAULT 0,    -- 0=Sunday ... 6=Saturday
    hour_of_day             INTEGER NOT NULL DEFAULT 0,    -- 0–23

    -- Timestamp
    pushed_at               TEXT    NOT NULL               -- ISO 8601, e.g. "2026-03-05T11:40:00.000Z"
);
