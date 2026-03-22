#!/usr/bin/env node
/*
  Simple worker process for hello-cluster smoke test.
  Receives jobs via IPC: { type: 'job', job: { id, payload } }
  Responds with: { type: 'ack', id }
  Can optionally simulate a crash when receiving a special payload.
*/
import { setTimeout as sleep } from 'node:timers/promises';

process.on('message', async (msg) => {
  if (!msg || msg.type !== 'job' || !msg.job) return;
  const { id, payload } = msg.job;
  try {
    // Simulate variable processing time (50-200ms)
    const ms = 50 + Math.floor(Math.random() * 150);
    await sleep(ms);

    if (payload && payload.poison) {
      // Simulate processing error; let parent requeue after VT
      throw new Error('poison-message');
    }

    // Normal success
    if (process.send) process.send({ type: 'ack', id });
  } catch (err) {
    if (process.send) process.send({ type: 'nack', id, error: String(err) });
  }
});

// Keep process alive
setInterval(() => {}, 1 << 30);
