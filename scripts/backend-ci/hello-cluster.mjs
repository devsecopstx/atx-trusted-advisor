#!/usr/bin/env node
/*
  hello-cluster.mjs — Provider-agnostic fault-tolerance smoke test

  Goals
  - Spin up N single-CPU worker processes (simulated via child_process.fork)
  - Enqueue M jobs with a visibility-timeout lease and retry policy
  - Kill one worker mid-run to validate recovery and "exactly once" outcomes
  - Produce PASS/FAIL summary for CI use

  Notes
  - This is a local simulator to prove coordination semantics without any cloud deps.
  - It uses an in-memory queue + leasing model. Replace with Redis/SQS/Pub/Sub as needed.
*/
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
function argVal(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const WORKERS = parseInt(process.env.WORKERS || argVal('--workers', '4'), 10);
const JOBS = parseInt(process.env.JOBS || argVal('--jobs', '50'), 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || argVal('--max-retries', '5'), 10);
const LEASE_MS = parseInt(process.env.LEASE_MS || argVal('--lease-ms', '500'), 10);
const KILL_AFTER_MS = parseInt(process.env.KILL_AFTER_MS || argVal('--kill-after-ms', '800'), 10);

const workerPath = resolve(__dirname, './worker.mjs');

/** In-memory queue with leasing */
const queue = [];
const leases = new Map(); // jobId -> { workerPid, leaseUntil, attempts }
const completed = new Set();
const failed = new Map(); // jobId -> error

for (let i = 0; i < JOBS; i++) {
  // insert a poison job for demonstration
  if (i === Math.floor(JOBS / 3)) {
    queue.push({ id: `job-${i}`, payload: { poison: true } });
  } else {
    queue.push({ id: `job-${i}`, payload: { n: i } });
  }
}

function leaseJob(workerPid) {
  // Re-queue expired leases first
  const now = Date.now();
  for (const [jobId, lease] of [...leases.entries()]) {
    if (lease.leaseUntil <= now) {
      leases.delete(jobId);
      // Put job back to front of queue
      queue.unshift({ id: jobId, payload: lease.payload });
    }
  }

  // Pull next available job that is not completed and not leased
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) break;
    if (completed.has(job.id) || leases.has(job.id)) continue;
    const attempts = (leases.get(job.id)?.attempts || 0) + 1;
    leases.set(job.id, {
      workerPid,
      leaseUntil: Date.now() + LEASE_MS,
      attempts,
      payload: job.payload,
    });
    return job;
  }
  return null;
}

function requeue(jobId) {
  const l = leases.get(jobId);
  if (!l) return;
  leases.delete(jobId);
  if (l.attempts >= MAX_RETRIES) {
    failed.set(jobId, `max-retries(${l.attempts})`);
  } else {
    queue.push({ id: jobId, payload: l.payload });
  }
}

function ack(jobId) {
  const l = leases.get(jobId);
  if (!l) return;
  leases.delete(jobId);
  completed.add(jobId);
}

/** Worker pool */
const workers = [];
for (let i = 0; i < WORKERS; i++) {
  const p = fork(workerPath, [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
  workers.push(p);
}

function assignLoop() {
  // Round-robin simple assignment
  let idx = 0;
  const timer = setInterval(() => {
    const alive = workers.filter(w => w.connected);
    if (alive.length === 0) {
      clearInterval(timer);
      return;
    }
    const w = alive[idx % alive.length];
    idx++;
    const job = leaseJob(w.pid);
    if (job && w.connected) w.send({ type: 'job', job });
  }, 25);
  return timer;
}

function attachHandlers() {
  for (const w of workers) {
    w.on('message', (m) => {
      if (!m || !m.type) return;
      if (m.type === 'ack') {
        ack(m.id);
      } else if (m.type === 'nack') {
        requeue(m.id);
      }
    });
    w.on("exit", () => {
      // Any leases for this worker get reclaimed on next lease sweep
    });
  }
}

async function main() {
  console.log('junie-aTx⚡dev-agent hello-cluster start 0.0.0-local');
  attachHandlers();
  const t = assignLoop();

  // Kill one worker mid-run to validate recovery
  await sleep(KILL_AFTER_MS);
  const victim = workers.find(w => w.connected);
  if (victim) {
    console.log(`[hello-cluster] killing worker pid=${victim.pid}`);
    victim.kill('SIGKILL');
  }

  // Wait until queue drained and leases resolved
  const start = Date.now();
  while (true) {
    // Reclaim expired leases (handled in leaseJob)
    leaseJob(-1); // sweep

    if (completed.size + failed.size === JOBS) break;
    if (Date.now() - start > 30000) break; // 30s timeout
    await sleep(50);
  }

  clearInterval(t);
  workers.forEach(w => { try { w.kill('SIGTERM'); } catch {} });

  const ok = completed.size >= JOBS - 1 && failed.size >= 1; // expect 1 poison to fail
  const summary = {
    workersPlanned: WORKERS,
    jobsPlanned: JOBS,
    completed: completed.size,
    failed: failed.size,
    durationMs: Date.now() - start,
    pass: ok,
  };
  if (ok) {
    console.log('[hello-cluster] PASS', summary);
    process.exit(0);
  } else {
    console.error('[hello-cluster] FAIL', summary);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[hello-cluster] ERROR', e);
  process.exit(1);
});
