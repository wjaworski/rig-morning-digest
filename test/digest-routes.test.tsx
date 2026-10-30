import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

function makeRunsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('renders rows with the lane banner and returns matching JSON', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), [
      JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'zeta', status: 'retry', owner: null, error: 'busy' }),
      JSON.stringify({ at: '2026-10-28T01:01:00+01:00', job: 'alpha', status: 'fail', owner: 'lane-07', error: 'bad' }),
      JSON.stringify({ at: '2026-10-28T01:02:00+01:00', job: 'zeta', status: 'ok', owner: 'rook' }),
      'not json',
    ].join('\n'));
    process.env.LANE_MARKER = 'TEST-MARKER';
    const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const api = await app.request('/api/digest/2026-10-28');
    const data = await api.json();

    expect(page.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('ignored malformed lines: 1');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(api.status).toBe(200);
    expect(data.rows.map((row: { job: string }) => row.job)).toEqual(['alpha', 'zeta']);
    expect(data.badLines).toBe(1);
    expect(data.rows[1]).toMatchObject({ owner: 'rook', runs: 2, retries: 1, lastStatus: 'ok' });
  });

  it('returns 404 for a night with no file', async () => {
    const app = createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir: makeRunsDir() });
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders an empty night and returns empty JSON rows', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const app = createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir });

    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await (await app.request('/api/digest/2026-10-28')).json()).toEqual({ rows: [], badLines: 0 });
  });

  it('links every night on the status board with counts', async () => {
    const runsDir = makeRunsDir();
    mkdirSync(runsDir, { recursive: true });
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'alpha', status: 'fail', owner: null }));
    writeFileSync(join(runsDir, '2026-10-27.jsonl'), JSON.stringify({ at: '2026-10-27T01:00:00+01:00', job: 'beta', status: 'ok', owner: 'rook' }));
    const app = createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir });
    const html = await (await app.request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('ok 0 / retry 0 / fail 1');
    expect(html).toContain('href="/digest/2026-10-27"');
  });
});
