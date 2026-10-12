// Afterlight relay credentials (Cloudflare Worker)
//
// Hands the game short-lived Cloudflare TURN credentials so fireteam members
// can connect through Cloudflare's relay when a direct connection is blocked.
// The long-lived TURN key never leaves Cloudflare.
//
// Settings > Variables and Secrets on this Worker:
//   TURN_KEY_ID         (text)    the TURN key's ID
//   TURN_KEY_API_TOKEN  (secret)  the TURN key's API token

const ALLOWED_ORIGINS = ['https://bryce-and.github.io', 'http://localhost:8123', 'http://127.0.0.1:8123'];
const TTL_SECONDS = 4 * 60 * 60;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed) return json({ error: 'This relay only serves the Afterlight game.' }, 403, cors);
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ error: 'TURN_KEY_ID or TURN_KEY_API_TOKEN is not set on the Worker.' }, 500, cors);

    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    });
    if (!res.ok) return json({ error: `Cloudflare TURN API returned ${res.status}` }, 502, cors);
    const data = await res.json();
    // Browsers block port 53, so drop those URLs to avoid waiting on them.
    for (const s of data.iceServers) s.urls = [].concat(s.urls).filter((u) => !/:53(\?|$)/.test(u));
    return json(data, 200, { ...cors, 'Cache-Control': 'no-store' });
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
