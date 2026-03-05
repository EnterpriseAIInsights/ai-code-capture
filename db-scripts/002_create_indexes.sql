-- ============================================================
-- Script : 002_create_indexes.sql
-- Purpose: Create indexes to support common analytics queries
-- ============================================================

-- Fast lookup by developer
CREATE INDEX IF NOT EXISTS idx_commit_metrics_user_email
    ON commit_metrics (user_email);

-- Fast lookup by branch (branch-level AI ratio reports)
CREATE INDEX IF NOT EXISTS idx_commit_metrics_branch_name
    ON commit_metrics (branch_name);

-- Fast lookup by repository
CREATE INDEX IF NOT EXISTS idx_commit_metrics_repo_name
    ON commit_metrics (repo_name);

-- Time-series queries (trend charts, date range filters)
CREATE INDEX IF NOT EXISTS idx_commit_metrics_pushed_at
    ON commit_metrics (pushed_at);

-- Heatmap queries (productivity by day/hour)
CREATE INDEX IF NOT EXISTS idx_commit_metrics_day_hour
    ON commit_metrics (day_of_week, hour_of_day);

-- AI tool attribution queries
CREATE INDEX IF NOT EXISTS idx_commit_metrics_ai_tool
    ON commit_metrics (ai_tool_detected);
