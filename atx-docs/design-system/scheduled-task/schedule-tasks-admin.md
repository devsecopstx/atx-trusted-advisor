ATX Finance Scheduled Tasks Design (Simple & Scalable
minimal yet production-ready for a finance platform. One unified model handles both platform-level (system-wide jobs like nightly ledger reconciliation, market-data sync, interest accrual) and user-level jobs (personal recurring transfers, portfolio snapshots, tax-report generation, alerts).
No separate tables, no duplication. Everything is stored in mongo

1. Database Model (scheduled_tasks table)


CREATE TABLE scheduled_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type       TEXT NOT NULL CHECK (task_type IN ('platform', 'user')),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for platform jobs
    
    job_key         VARCHAR(255) NOT NULL,           -- e.g. 'daily_portfolio_snapshot', 'send_monthly_tax_report'
    cron_expression VARCHAR(100) NOT NULL,           -- standard cron (supports @daily, @hourly too)
    payload         JSONB NOT NULL DEFAULT '{}',     -- job-specific params, e.g. {"frequency": "monthly", "report_type": "summary"}
    
    is_enabled      BOOLEAN DEFAULT true,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,                     -- pre-computed for fast polling / indexing
    
    created_by      UUID NOT NULL REFERENCES users(id),  -- admin or system
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT platform_no_user CHECK (
        (task_type = 'platform' AND user_id IS NULL) OR
        (task_type = 'user' AND user_id IS NOT NULL)
    )
);

-- Indexes for scheduler performance
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks (next_run_at) WHERE is_enabled = true;
CREATE INDEX idx_scheduled_tasks_user ON scheduled_tasks (user_id) WHERE task_type = 'user';
CREATE INDEX idx_scheduled_tasks_job_key ON scheduled_tasks (job_key);


Why this is perfect for finance:

job_key → maps to a Python/FastAPI handler registry (e.g. handlers[job_key](task)).
payload is JSONB → fully flexible for any finance params without schema changes.
next_run_at pre-computed → scheduler just does WHERE next_run_at <= NOW() (blazing fast).

2. Scheduler (Simple & Reliable)
Recommended stack (Python):

APScheduler 4.x with AsyncSQLAlchemyJobStore (or plain DB poller if you want zero dependencies).
Runs as a background FastAPI worker (or separate service).

# Example handler registry (in your codebase)
JOB_HANDLERS = {
    "daily_portfolio_snapshot": portfolio_snapshot_handler,
    "send_monthly_tax_report": tax_report_handler,
    # ... any platform or user job
}

async def execute_task(task: ScheduledTask):
    handler = JOB_HANDLERS.get(task.job_key)
    if not handler:
        return
    await handler(task)   # task.payload + task.user_id available
    # after success: update last_run_at + recalculate next_run_at using cron parser


    Cron parsing: Use croniter (battle-tested, handles every finance schedule you’ll ever need).
Fallback (ultra-simple): A Celery beat + DB poller that runs every 60 seconds and enqueues tasks to Celery/RabbitMQ.

3. Admin API (FastAPI + Pydantic)
All endpoints require admin role (JWT claim role: admin).
Base path: /api/v1/admin/scheduled-tasks


Method,Endpoint,Description,Key Request Body Fields
GET,/,"List tasks (filter by type, user_id, job_key)",?task_type=platform&user_id=...
GET,/{task_id},Get single task,—
POST,/,Create new task,"task_type, user_id?, job_key, cron_expression, payload"
PUT,/{task_id},Update (including pause/resume),"is_enabled, cron_expression, payload"
DELETE,/{task_id},Delete task,—
POST,/{task_id}/trigger,Manually trigger now (for testing),—

Example request (create platform job):

POST /api/v1/admin/scheduled-tasks
{
  "task_type": "platform",
  "job_key": "nightly_ledger_reconciliation",
  "cron_expression": "0 2 * * *",          // 2am daily
  "payload": {
    "dry_run": false,
    "notify_slack": true
  }
}


4. Extra Finance-Grade Touches (still simple)

Auditing: Add a task_execution_logs table (id, task_id, status, started_at, duration_ms, error) for compliance.
User-level safety: When executing a user job, always scope DB queries with WHERE user_id = task.user_id.
Platform jobs run with elevated service account (no user context).
Rate limiting & concurrency: APScheduler or Celery naturally handles it; add max_instances=1 per task if needed.
Soft delete (just set is_enabled=false) instead of hard delete for audit.

Why This Design Wins

One model → zero maintenance overhead.
Cron → supports every schedule a finance app needs (daily, weekly, month-end, etc.).
Admin API → full control for your ops team (pause broken jobs, add new ones, trigger manually).
Scalable → works with 10 tasks or 100k user recurring jobs.
Easy to implement → you can have the full thing running in < 1 day.