import { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} runsDir={config.runsDir} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || !existsSync(`${config.runsDir}/${night}.jsonl`)) {
      return c.notFound();
    }

    const result = readNight(config.runsDir, night);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} rows={result.rows} badLines={result.badLines} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || !existsSync(`${config.runsDir}/${night}.jsonl`)) {
      return c.notFound();
    }
    return c.json(readNight(config.runsDir, night));
  });

  return app;
}
