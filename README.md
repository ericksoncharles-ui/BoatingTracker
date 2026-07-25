# Boating Trip Planner

Trip planning for Long Island Sound — distances, fuel, no-wake delays, shoal avoidance,
and an AI-generated harbor master briefing.

## Setup

```bash
npm install
cp .env.example .env   # then put your real key in .env
```

`.env` is gitignored. The key is read **only** by the API server.

## Running

The app is two processes in development:

```bash
npm run server   # API server on :3001 (holds the Anthropic key)
npm run dev      # Vite dev server on :5173, proxies /api → :3001
```

In production, build once and let the API server serve the built app too:

```bash
npm run build
npm start        # serves dist/ and /api/briefing on :3001
```

## Why the briefing call is server-side

Anything in the browser bundle is public. Vite inlines every `VITE_*` environment
variable into the client JavaScript at build time, so a `VITE_ANTHROPIC_API_KEY`
is readable by anyone who opens devtools — the Anthropic SDK's
`dangerouslyAllowBrowser` flag exists to flag exactly that.

So the browser never talks to the Anthropic API. It POSTs structured trip data to
`/api/briefing`, and `server/index.js` builds the prompt and makes the API call
with the key held in the server process.

Two things follow from that design:

- **The server builds the prompt, not the client.** The endpoint accepts trip
  fields (place names, distance, speed), never prompt text, so it can't be used
  as a free Claude proxy.
- **The endpoint is rate limited** (30 requests / 10 min per IP), since it is
  public once deployed and spends your key.

If the briefing call fails for any reason — no key configured, API error, rate
limit — the UI falls back to a locally generated briefing and drops the "AI" badge.
