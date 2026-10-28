// Cloudflare Worker that lets the planner read iCloud public calendars.
// Browsers can't download iCloud .ics files directly (no CORS headers), so this relays them.
// It only forwards https://*.icloud.com addresses and, when TOKEN is set, only for requests that carry it.
//
// Settings (Worker → Settings → Variables and Secrets):
//   TOKEN         secret  — any password; type the same one into the app's 캘린더 설정
//   ALLOW_ORIGIN  text    — https://swimmingchoi.github.io  (the address the app is served from)

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'x-token',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('GET only', { status: 405, headers: cors });
    if (env.TOKEN && request.headers.get('x-token') !== env.TOKEN) return new Response('unauthorized', { status: 401, headers: cors });

    let target;
    try { target = new URL(new URL(request.url).searchParams.get('url').replace(/^webcal:/i, 'https:')); }
    catch { return new Response('missing or invalid ?url=', { status: 400, headers: cors }); }
    if (target.protocol !== 'https:' || !/(^|\.)icloud\.com$/i.test(target.hostname)) {
      return new Response('only iCloud calendar links are relayed', { status: 403, headers: cors });
    }

    const upstream = await fetch(target.toString(), { headers: { 'User-Agent': 'braindump-weekly-relay' }, redirect: 'follow' });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  },
};
