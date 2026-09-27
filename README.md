# Boating Trip Planner

Trip planning from Long Island Sound to Nantucket: routes found on NOAA's
surveyed depths for your draft, distances, fuel, no-wake delays, live tides and
wind, and an optional AI-written passage briefing.

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

## Routes are found on the surveyed depths

Nobody draws the routes. The planner holds a grid of charted depths covering
the water from City Island to Nantucket, cells of about 18.5 m (20 yards), each
holding the shallowest depth surveyed in it. For a trip it finds the shortest
way through cells at least as deep as the boat's draft plus 2 ft under the
keel, rounded up to a chart depth (a boat needing 9 ft is held to 10). Land,
rocks and shoals need no list of their own: they are simply not water deep
enough.

Near either end the route may cross shallower water, keeping to the deepest
there is, and in the last few hundred yards cells the survey has as dry,
because a marina is often shallower
than the boat wants (that is the tide's business, and the trip summary warns
about the harbor's controlling depth) and a dredged cut can be narrower than a
cell. The summary reports how much of each end is in water shallower than the
route was held to, and the map draws those stretches in orange (shallow) and
red (dry).

Two passages are closed on purpose: the Sakonnet River at the Tiverton bridges
and the Cape Cod Canal. Whether a boat gets through either turns on a bridge
clearance or canal rules, which the planner doesn't have, so routes go the long
way round instead.

To see what the router does:

```bash
npm run route:probe                        # grid, places, a sample of routes
npm run route:probe -- newport cuttyhunk   # one route, leg by leg
npm run route:probe -- --all               # every pair of places, 3 ft draft
npm run route:probe -- --all --draft 6     # the same for a keel boat
```

`--all` walks every route again cell by cell and fails any that breaks the
router's rules, and reports how long routes take to plan.

### Depth data

`public/depth-grid.bin` is built by `npm run depth:build`
(`scripts/build-depth.py`, which needs Python with `pip install rasterio numpy`)
from NOAA's National Bathymetric Source navigation surfaces: the compiled
hydrographic surveys the nautical charts are made from, on chart datum (MLLW),
published on NOAA's open data bucket on AWS. They are public domain, and the map
credits them whenever a route is drawn. Surveys age and sand shoals move, so the
routes are a plan to check against the chart, not a substitute for it.
