# Boating Trip Planner

Trip planning from Long Island Sound to Nantucket: distances, fuel, no-wake delays,
routes kept off the land and clear of shoals for your draft, live tides and wind,
and an optional AI-written passage briefing.

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
- **The endpoint is rate limited** (30 requests / 10 min per IP, shared with the
  fishing summary), since it is public once deployed and spends your key. The
  limit keys on the caller's IP, so set `TRUST_PROXY` to match the deployment:
  `1` (the default) behind a single reverse proxy or a host's load balancer, `0`
  when the server faces the internet directly. Trusting a proxy that isn't there
  lets a caller pick their own IP with an `X-Forwarded-For` header, and with it
  a fresh budget per request.

If the briefing call fails for any reason — no key configured, API error, rate
limit — the UI falls back to a locally generated briefing and drops the "AI" badge.

## The fishing report summary

The Fishing Reports tab leads with an aggregate summary of the tackle-shop and
regional report pages it links to. It runs on a button press, not on page load —
reading four sites and summarizing them costs an API call, so it happens when
you ask for it. `GET /api/fishing-summary` fetches those pages, strips them to
text, and has Claude summarize what the reports actually say — which species,
where, and on what.

That also has to be server-side: the report sites send no CORS headers, so the
browser can't fetch them at all. The result is cached for 30 minutes (the reports
themselves are weekly), and a stale summary is served for up to 12 hours if a
refresh fails. Sources that can't be reached are reported to the UI and shown
dimmed rather than silently dropped.

When it fails, the card says which failure it was, because the fixes differ: no
API key on the server, no report site reachable, pages that loaded with no
readable report in them, rate limited, or the API server not running at all.

Regulation links (CT DEEP, NY DEC) are deliberately left out of the summary —
seasons and bag limits should be read at the source, not paraphrased by a model.

## Sea state is estimated, not fetched

There is no live buoy reader in this app. The Conditions tab's Sea State card
is always a computed estimate — `estimateWindWaves` in `src/services/forecast.js`
turns the real Open-Meteo wind reading into a significant wave height and period
using the simplified SMB fetch-limited relations over a model of the fetch of
whichever water the position is in (the Sound, the Peconic bays, Narragansett or
Buzzards Bay, or the open sounds to the east), then adjusts it for whether the
wind is running with or against the real NOAA CO-OPS tide (a wind-against-tide
sea is steeper; wind-with-tide is flatter). Tides and wind/weather themselves
are unaffected by any of this — both remain live fetches, from NOAA CO-OPS and
Open-Meteo respectively. The card is always labelled "Estimated," never
presented as a measurement.

## Routes are checked against the real shoreline

The router plans over a hand-placed channel graph, and every shortcut it takes
between waypoints is tested against real land polygons in
`src/coastlineData.js`, so a route can't run over an island or a barrier beach.
Shoals too shallow for the boat's draft (plus 2 ft under the keel) are routed
around on the water; if there is no way round, the trip summary says so.

To see what the router does:

```bash
npm run route:probe                        # graph checks and a sample of routes
npm run route:probe -- newport cuttyhunk   # one route, leg by leg
npm run route:probe -- --land              # every pair of places, 3 ft draft
npm run route:probe -- --land --draft 6    # the same for a keel boat
```

`--land` fails any route whose middle legs cross land or a too-shallow shoal.
Its `harbor leg` warnings are the dock ends of routes up inner harbors and rivers
the shoreline is too coarse to resolve, and are expected.

### Shoreline data and its license

`src/coastlineData.js` is generated by `npm run coastline:build` from GSHHG, the
Global Self-consistent Hierarchical High-resolution Geography by Paul Wessel and
Walter H. F. Smith, at full resolution (built from the 1:250,000 World Vector
Shoreline, good to about 100 m). GSHHG is distributed under the GNU Lesser
General Public License v3, and the generated file, being derived from it, is
under the same license: https://www.soest.hawaii.edu/pwessel/gshhg/. The map
credits it whenever a route is drawn.
