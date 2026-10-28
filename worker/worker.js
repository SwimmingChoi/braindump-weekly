// Cloudflare Worker for 브레인덤프 위클리. Two jobs:
//   GET /?url=<iCloud public calendar link>  — relays the .ics file (browsers can't download iCloud calendars directly)
//   GET|PUT /data                            — keeps the planner in sync between your devices (needs a KV binding)
// Every request must carry the TOKEN password. Only https://*.icloud.com addresses are relayed.
//
// Settings (Worker → Settings):
//   Variables and Secrets
//     TOKEN         secret — any password; type the same one into the app's 캘린더 설정
//     ALLOW_ORIGIN  text   — https://swimmingchoi.github.io  (the address the app is served from)
//   Bindings
//     PLANNER       KV namespace — where the synced planner is stored

const TOMBSTONE_DAYS = 90;   // deleted items are remembered this long so a stale device can't bring them back

// Same rule as the app: item by item, the newer change wins.
function mergeDocs(stored, incoming) {
  const items = { ...(stored.items || {}) };
  for (const [k, it] of Object.entries(incoming.items || {})) {
    if (!it || typeof it.u !== 'number') continue;
    if (!items[k] || it.u > items[k].u) items[k] = it;
  }
  const cutoff = Date.now() - TOMBSTONE_DAYS * 864e5;
  for (const [k, it] of Object.entries(items)) if (it.d && it.u < cutoff) delete items[k];
  return { items };
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'x-token, content-type',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Vary': 'Origin',
    };
    const reply = (body, status = 200, type = 'text/plain; charset=utf-8') =>
      new Response(body, { status, headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'no-store' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!env.TOKEN) return reply('set the TOKEN secret first', 403);
    if (request.headers.get('x-token') !== env.TOKEN) return reply('unauthorized', 401);

    const url = new URL(request.url);

    if (url.pathname === '/data') {
      if (!env.PLANNER) return reply('bind a KV namespace as PLANNER', 501);
      const raw = await env.PLANNER.get('doc');
      const stored = raw ? JSON.parse(raw) : { items: {} };
      if (request.method === 'GET') return reply(JSON.stringify(stored), 200, 'application/json');
      if (request.method !== 'PUT') return reply('GET or PUT only', 405);
      let incoming;
      try { incoming = await request.json(); } catch { return reply('body must be JSON', 400); }
      const merged = mergeDocs(stored, incoming);
      const out = JSON.stringify(merged);
      if (out !== raw) await env.PLANNER.put('doc', out);   // skip the write when nothing changed (free plan: 1,000 writes/day)
      return reply(out, 200, 'application/json');
    }

    if (request.method !== 'GET') return reply('GET only', 405);
    let target;
    try { target = new URL(url.searchParams.get('url').replace(/^webcal:/i, 'https:')); }
    catch { return reply('missing or invalid ?url=', 400); }
    if (target.protocol !== 'https:' || !/(^|\.)icloud\.com$/i.test(target.hostname)) {
      return reply('only iCloud calendar links are relayed', 403);
    }
    const upstream = await fetch(target.toString(), { headers: { 'User-Agent': 'braindump-weekly-relay' }, redirect: 'follow' });
    return reply(await upstream.text(), upstream.status, 'text/calendar; charset=utf-8');
  },
};
