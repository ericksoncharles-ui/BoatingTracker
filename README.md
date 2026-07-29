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
npm start        # serves dist/ and the /api routes on :3001
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

## The fishing report summary

The Fishing Reports tab leads with one aggregate summary of the tackle-shop and
regional report pages it links to. `GET /api/fishing-summary` fetches those pages,
strips them to text, and has Claude summarize what the reports actually say —
which species, where, and on what.

That also has to be server-side: the report sites send no CORS headers, so the
browser can't fetch them at all. The result is cached for 30 minutes (the reports
themselves are weekly), and a stale summary is served for up to 12 hours if a
refresh fails. Sources that can't be reached are reported to the UI and shown
dimmed rather than silently dropped, and if the whole call fails the card
degrades to a line pointing at the source links.

Regulation links (CT DEEP, NY DEC) are deliberately left out of the summary —
seasons and bag limits should be read at the source, not paraphrased by a model.

## Live sea state from the UConn buoys

The Conditions tab's Sea State card prefers readings taken straight off the UConn
LISICOS buoys' own observation pages. `GET /api/sea-state` fetches those pages for
all four Sound buoys, strips them to text, and has Claude read the latest
observation out of each — wave height and period, wave and wind direction, wind
speed and gusts, water and air temperature, pressure.

Server-side for the same reason as the fishing summary, plus one more: UConn's
pages send no CORS headers, and its ERDDAP server is plain HTTP on a non-standard
port, which an HTTPS page is not allowed to fetch at all.

Claude rather than a scraper because these are human-facing observation panels —
labels, units, and layout differ between stations and get redesigned without
notice, and a selector-based parser would be the first thing to break.

The model is not trusted with the numbers, though:

- It reports each value **exactly as the page prints it, with the printed unit**,
  and the server does the conversion. A units error is the one mistake this app's
  domain rules care most about, and asking the model to convert would put it
  somewhere nothing can check.
- Every converted reading is range-checked against the same plausible bounds the
  ERDDAP reader uses (`PLAUSIBLE_READING_RANGES` in `src/utils.js`). Anything
  outside them is dropped rather than shown.
- Observation times that are in the future or more than 12 hours old are dropped,
  so a misread timestamp can't make stale water look current.
- It is told to return null rather than estimate, and never to carry a value over
  from another buoy or from a forecast on the same page.

Results are cached for 10 minutes and a stale payload is served for up to 3 hours
if a refresh fails. The endpoint takes no position — all four buoys come back in
one response and the browser picks the nearest one that is reporting, which keeps
the skipper's location in the browser and lets every request share a cache entry.

If any of it is unavailable — no key, dead page, failed call — the card falls back
to the ERDDAP buoy feed and then to a wind-driven estimate, exactly as before. The
Sea State card is labelled with which of those you are looking at.
