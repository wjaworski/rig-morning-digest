import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightRead } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.at !== 'string' || Number.isNaN(Date.parse(event.at)) ||
    typeof event.job !== 'string' || event.job.length === 0 ||
    (event.status !== 'ok' && event.status !== 'retry' && event.status !== 'fail') ||
    !(event.owner === null || typeof event.owner === 'string') ||
    (event.error !== undefined && typeof event.error !== 'string')
  ) {
    return null;
  }

  return {
    at: event.at,
    job: event.job,
    status: event.status,
    owner: event.owner,
    ...(typeof event.error === 'string' ? { error: event.error } : {}),
  };
}

export function readNight(runsDir: string, night: string): NightRead {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    throw new Error('night must be a YYYY-MM-DD date');
  }

  const content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const event = parseEvent(line);
    if (!event) {
      badLines += 1;
      continue;
    }

    const current = rows.get(event.job);
    if (!current) {
      rows.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }

    rows.set(event.job, {
      ...current,
      owner: event.owner,
      runs: current.runs + 1,
      retries: current.retries + (event.status === 'retry' ? 1 : 0),
      lastStatus: event.status,
      lastError: event.error ?? null,
      lastAt: event.at,
    });
  }

  return { rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), badLines };
}
