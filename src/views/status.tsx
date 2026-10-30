import type { Status } from '../status.js';
import { readNight } from '../digest/read-night.js';

export function StatusBoard({ status, runsDir }: { status: Status; runsDir: string }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((night) => {
            const { rows } = readNight(runsDir, night);
            const counts = rows.reduce((total, row) => {
              total[row.lastStatus] += 1;
              return total;
            }, { ok: 0, retry: 0, fail: 0 });
            return (
              <li>
                <a href={`/digest/${night}`}>{night}</a> · ok {counts.ok} / retry {counts.retry} / fail {counts.fail}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
