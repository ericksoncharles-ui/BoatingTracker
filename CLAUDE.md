# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this app is

A single-page **southern New England boating trip planner**, home waters Long
Island Sound. The user picks a start and destination, enters boat specs (tank
size, cruising speed, fuel burn, draft), and gets back a route kept to water
deep enough for that draft, with distance, travel time, fuel usage,
no-wake-zone delays, harbor draft warnings, and nearby points of interest,
plotted over a NOAA nautical chart.

Destinations run west to east through six regions: Long Island Sound, Peconic &
Gardiners Bay, Block Island & Rhode Island Sound, Narragansett Bay, Buzzards Bay,
and Vineyard & Nantucket Sound. The Sound is still the centre of gravity — the
default view, the fishing links and the species calendar are all Sound-specific.

There is no database. Places, zones and points of interest are hardcoded in
`src/data.js`, the water itself is a depth grid built from NOAA's surveys
(`public/depth-grid.bin`), and every navigation calculation happens
client-side. The only server (`server/`) is
a small Express process that holds the Anthropic key and reaches the third-party
pages the browser can't fetch itself.

It is installable as a PWA (`public/manifest.json`, iOS meta tags in
`index.html`) and is expected to be usable on a phone at the helm.

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run preview  # serve the build

npm run tides:probe      # which NOAA station each location resolves to
npm run fishing:probe    # what each fishing source actually yields
npm run route:probe      # depth grid, place positions, closed waters, sample routes
npm run depth:build      # rebuild public/depth-grid.bin from NOAA's surveys (Python)
```

`route:probe` takes a pair (`npm run route:probe -- newport cuttyhunk`) to print
one route leg by leg, or `-- --all` for every pair of places (about 4,750, five
minutes on four threads). Every route is walked again cell by cell against the
router's own rules: nothing through closed water, water too shallow for the
draft only near an end, dry cells only in the last few hundred yards. Any breach
fails the run. It warns about a place whose position is on a dry cell and a
route that took over a second to plan, prints planning-time percentiles, and
lists routes over 2.5 times the straight line to look at on the chart. The
current ones are all real: from one side of Block Island or Shelter Island to
the other, round Lloyd Neck, West Chop or Shippan Point, and short hops off
Westport, Cockenoe and Orient Point across flats too thin to cut (at 6 ft,
Norwalk to Westport goes outside the Norwalk Islands too). The draft is 3 ft;
add `--draft 6` for a keel boat. Run both before committing a change to
`data.js`, the router or the grid.

`depth:build` needs Python 3.9+ with rasterio and numpy (`pip install rasterio
numpy`), downloads about 1.3 GB of survey tiles into a cache and takes a couple
of minutes. The built file is committed, so nothing else needs Python.

There are **no tests and no linter configured**. Verify changes by running
`npm run dev` and exercising the UI. If you add tests, wire them into
`package.json` scripts.

## Stack

React 18 + Vite 5, `react-leaflet` v4 / Leaflet 1.9 for mapping,
`@anthropic-ai/sdk` for the optional Claude-backed endpoints. Plain CSS in a single
file — no CSS framework, no TypeScript, no state library.

## Layout

```
index.html            PWA meta tags, manifest link
src/main.jsx          React root
src/App.jsx           Tab state + desktop/mobile layouts + bottom-sheet drag
src/App.css           All styling (~2500 lines), CSS vars in :root
src/data.js           Places, closed waters, shoal circles (map only), no-wake zones, POIs
src/utils.js          Pure navigation/fuel math, no React
src/depthGrid.js      Loads, decodes and walks the depth grid, no React
src/router.js         Shortest route on the depth grid for a given depth, no React
src/hooks/useTripCalculator.js   Owns all form state, plans the route, orchestrates utils.js
src/hooks/useConditions.js       Fetches every live conditions source for one position
src/services/noaaTides.js        Tide predictions
src/services/forecast.js         Wind/weather forecast + the wind-and-tide wave estimate
src/services/nwsAlerts.js        Active marine alerts
src/components/Sidebar.jsx       Inputs + results panel
src/components/TripMap.jsx       Leaflet map, chart layers, live GPS
src/components/TripBriefing.jsx  Optional Claude-generated briefing
src/components/ConditionsPanel.jsx  Sea state, tides, wind, alerts
src/components/FishingSummary.jsx  Aggregate summary of the linked fishing reports
server/index.js       Express: /api/briefing, /api/fishing-summary, serves dist/
server/fishingSummary.js  Fetches + summarizes the fishing report sources
server/htmlText.js        HTML -> text pass for the fishing-summary page reader
scripts/build-depth.py    Downloads NOAA's navigation surfaces, builds public/depth-grid.bin
scripts/*-probe.mjs       The probes above
public/depth-grid.bin     Generated depth grid (NOAA, public domain); never edit by hand
public/sw.js              Service worker: offline app shell and depth grid
```

**Where to make a change:**

- New marina / shoal circle / no-wake zone / POI → `src/data.js` only. Put a
  place's position on the water at its docks or anchorage, then
  `npm run route:probe -- <id> <another id>` to see a route to it, and
  `-- --all` (at both drafts) to see that nothing else broke.
- How a route is found → `src/router.js`. What the grid holds →
  `scripts/build-depth.py`, then `npm run depth:build`.
- Change how a number is computed → `src/utils.js` (keep functions pure).
- New input or result field → `useTripCalculator.js` + `Sidebar.jsx`.
- Map layers, markers, GPS behavior → `TripMap.jsx`.
- New live conditions source → a module in `src/services/` + a section key in
  `useConditions.js` + a card in `ConditionsPanel.jsx`.

## Domain rules that matter

Getting these wrong produces plausible-looking but wrong navigation output.

- **Units are nautical.** Distances in nautical miles, speed in knots, depth in
  feet at MLW, fuel in gallons and GPH. `calcDistanceNM` computes kilometers via
  Haversine and divides by 1.852 — don't "simplify" that away.
- **Routes are found on the survey, not drawn.** `planRoute` (`router.js`) finds
  the shortest way through water charted at least as deep as the boat needs, on
  the depth grid (`depthGrid.js`, `public/depth-grid.bin`): NOAA's National
  Bathymetric Source navigation surfaces, the compiled surveys the ENCs are
  drawn from, on chart datum (MLLW), pooled into cells of about 18.5 m that each
  hold the *shallowest* depth surveyed in them, so a rock is never averaged into
  the water beside it. There is no channel graph, no curated waypoint and no
  land polygon any more. The hand-drawn graph put Marion's approach on the neck
  beside Sippican Harbor, and every point like it was a route over land. Don't
  bring back waypoints to steer a route: if a route is wrong, the grid or a
  place's position is, and route:probe will say which.
- **Depth is held to draft plus `KEEL_CLEARANCE_FT` (2 ft), rounded up to a
  chart step.** A cell stores how many of the header's steps it reaches (1 3 4 5
  6 7 8 10 12 15 20 25 ft), and `requiredStep` takes the first step at least as
  deep as asked: a boat needing 9 ft is held to 10, never allowed 8. 0 is dry at
  low water, land or unsurveyed, and the router treats them alike. The grid
  can't tell anything past 25 ft, so `BOAT_LIMITS.draft` has to stay at or under
  23 ft.
- **Water is priced by the mile** (the `_COST` constants in `router.js`): deep
  enough 1 (see the standoff below); too shallow 26, plus 25 for every foot short, so a foot short is 51;
  dry 500; closed not at all. Shallow water is allowed only within 3 NM of
  either end and dry cells within 0.25 NM (`REACH`). That is for harbors: a
  marina is often shallower than the boat wants, which is the harbor draft
  warning's and the tide's business, and a dock position can sit on the quay.
  The grading is what keeps a route up the channel rather than across the flats
  beside it; at one price for all shallow water the two were equal. Out in the
  Sound a shoal is never "worth it"; it is not water the route can use. An end
  with no way out at those allowances climbs `REACH` on its own:
  dry to 1.2 NM (Coecles Harbor's dredged cut is narrower than a cell, so it
  reads dry all the way across), then shallow to 6 NM. An 8 NM rung opened the
  North Fork's marsh creeks to routes into Greenport; don't widen the ladder
  for one harbor.
- **Routes stand off shallow water where they can.** The survey has the
  soundings but not the rocks the chart draws between them, nor the buoys set
  to keep boats wide of a ledge: east of Greens Ledge Light it has 5 ft in a
  150 m gap between two rock patches, and routes to Norwalk threaded it. So
  each cell also carries the least depth within `CLEARANCE_M` (91 m, about a
  hundred yards) of it, in the high four bits of its byte (grid format 2), and
  deep water with anything too shallow for the boat that close costs
  `NEAR_COST` (2) a mile plus `CLOSE_IN_TOLL` (1 NM) per visit, half going in
  and half coming out. At 1.5 a mile Stamford's routes east still went inside
  The Cows past Shippan Point. The toll is per visit, not per mile, because a dredged
  channel is all close water: charged only by the mile, a dart through a gap
  between two islands was cheaper than the length of Norwalk's channel and the
  route left the channel for it. A block or square of cells all deep enough
  counts as close in if any cell of it is (`viewFor`, `squareAround`): merged
  only when clear all round, the band along every shore went cell by cell and
  planning took twice as long. A format 1 grid still loads, read as clear
  everywhere.
- **A course can't slip diagonally between two worse cells** (`squeeze` in
  `walk`, the corner rule in `stepCost`): that is how a jetty drawn corner to
  corner would otherwise let a route through.
- **The search has to stay fast; it runs on the main thread.** Lazy Theta*
  (A* whose steps run in any direction, so open water is one straight line)
  over the grid's leaves, leaning 10% toward the destination (`WEIGHT`).
  `harborToll` tells it what the shallow way out of each end costs, so a dock on
  a dry cell doesn't send it combing fifty miles of water first. A rough pass
  over 150 m blocks, from the destination back, finds which way to go, and the
  fine search runs in a corridor 2 then 4 super-blocks (1.2 km each) either side
  of it (`CORRIDOR_WIDTHS`) before it searches everywhere. `pullTight` then
  straightens the path wherever a line costs no more. `route:probe -- --all`
  puts the median route at about 0.1 s and the slowest under 1 s in Node; a
  change that moves those needs a reason.
- **Places sit on the water, at their docks or anchorage.** `lat`/`lng` is where
  a route starts or ends. A position on a dry cell sends the router across it
  to the nearest water, which can be the wrong water (Cuttyhunk's was on the
  island's south shore), so route:probe warns about one. `approach` no longer
  steers anything: it is where a route to a landmark ends (you stand off a
  lighthouse, not land on it) and the water point the marine alerts ask about.
  Any new place needs a `region`, and `approachDepthFt` (controlling depth at
  MLW) *if* a published figure exists: the draft check is skipped when it is
  absent, which is the honest outcome for an open roadstead.
- **Two passages are deliberately closed**: the Sakonnet River at the Tiverton
  bridges and the Cape Cod Canal, boxes in `closedWaters` the router won't
  enter whatever the depth. Bristol to New Bedford and Marion to Hyannis
  therefore go the long way round, out of the bay and back up. That is the
  honest answer for a planner with no bridge clearances or canal traffic rules
  in it; don't open either unless you add those. route:probe fails a box that
  sits on no water, since it would close nothing.
- **The shallow ends of a route are reported, never hidden.** `describe` returns
  every stretch in water shallower than the route was held to, or over dry
  cells, with its least depth; the sidebar sums them for each end and the map
  draws them orange and red. That is where the grid's limits show (a cut
  narrower than a cell, a dock drawn on the quay, a creek the survey stops
  short of), so don't drop it. `shoalAreas` is the map's Shoals & Hazards layer
  and nothing else: the router never reads it, since the grid has every one of
  those shoals and the thousands nobody named.
- **The grid is a survey, and surveys age.** Sand shoals move, Nantucket
  Sound's most of all. `depth:build` takes the newest NBS tile scheme, and the
  grid's header records which scheme and when it was built (route:probe prints
  both). Rebuild it now and then, and never present a route as a substitute for
  the chart.
- **The harbor draft warning uses the same 2 ft.** Under 2 ft to spare at the
  approach is a caution; under the draft itself says wait for the tide. Boat
  inputs reach the arithmetic only through `parseBoatInputs` and `BOAT_LIMITS`
  in `utils.js`; the fields hold text so an emptied one isn't read as 0.
- **No-wake zones cost time and save fuel.** Delay is the difference between
  transit at cruising speed and at the zone's `speedLimit`; fuel in a zone burns
  at 30% of cruise GPH (`calcTripDetails`).
- **The fuel warning threshold is 70%** of tank capacity, used for both the
  sidebar warning and the gauge color.
- **POIs are measured against the plotted route**, not the straight line's
  midpoint, and anything more than 12 NM off the track is dropped rather than
  padded in. On a run to Nantucket the midpoint is out in Rhode Island Sound.

## UI conventions

- **Both place pickers group by region, then kind** (`PlacePicker`'s
  `KIND_GROUPS` x `placeRegions`, and the Conditions tab's `<optgroup>`s). Region
  order comes from the order the sections are declared in `data.js`, which is
  west to east — keep it that way. The kind grouping is a safety feature, not
  decoration: it is what tells the helm that "Greens Ledge Light" is not a place
  to tie up.
- **Desktop and mobile are separate DOM trees**, both rendered, toggled by
  `.desktop-only` / `.mobile-only` at the 768px breakpoint in `App.css`. A change
  to the planner UI usually needs to be made for both — `Sidebar` is rendered
  twice in `App.jsx` with identical props. What costs network (the Leaflet map
  and its tiles, the conditions panels) is mounted only in the tree the
  breakpoint shows, via `isMobileLayout`.
- Each layout is a `<main>`, the tab bars are `<nav>`s with `aria-current` on
  the current tab, every tab has an `h1`, and the bottom sheet is `inert` while
  another tab hides it. axe was clean against those; keep it so. Pinch zoom is
  on, so fields on mobile stay at 16px or iOS zooms into them.
- Mobile puts the map full-screen with the sidebar in a **draggable bottom
  sheet** (touch handlers in `App.jsx`, snap threshold at 25% of viewport
  height) plus a bottom tab bar. Respect `viewport-fit=cover` / safe-area insets
  when touching mobile chrome.
- Colors come from CSS custom properties in `:root` (`--navy`, `--sea`,
  `--warning`, `--gold`, …). Use them rather than literal hex values.
- Icons are inline SVGs, not an icon library.
- The visual register is nautical and restrained: navy/cream, compass rose,
  chart-like styling.

## Map notes

- Default base layer is the **NOAA nautical chart** tile service, which needs
  `zoomOffset={-2}`. OpenSeaMap buoys/marks and shoal circles are overlays
  checked on by default.
- `LiveLocation` calls `getCurrentPosition` *before* `watchPosition` — iOS
  Safari/Chrome often fail silently otherwise. It also requires a secure
  context, so GPS won't work over plain HTTP.
- Leaflet's default marker icons are re-registered from the package's PNGs in
  `TripMap.jsx`; bundlers break them otherwise.
- Map controls stop pointer/click propagation so map gestures don't swallow
  button presses.
- The plotted route carries `DEPTH_ATTRIBUTION` (NOAA National Bathymetric
  Source), since those depths are what it was planned on.

## AI briefing

`TripBriefing.jsx` POSTs trip values to `/api/briefing`; `server/index.js` builds
the prompt and calls the Anthropic API with `ANTHROPIC_API_KEY` (see
`.env.example` — **not** `VITE_`-prefixed, or Vite would inline it into the
client bundle). The endpoints accept data, never prompt text, so they can't be
used as a free Claude proxy, and they share a per-IP rate limit.

The briefing and the fishing summary run `claude-haiku-4-5`. It rejects the
`effort` parameter and doesn't think unless handed a `budget_tokens`, so neither
call passes `output_config` or `thinking` — copying those in from newer-model
examples returns a 400.

When the key is absent or the request fails, it falls back to
`generateFallbackBriefing`, a template-string summary, with a line under it
saying so. Keep that fallback working — the app must be fully usable with no API
key.

The rate limit keys on `req.ip`, so `TRUST_PROXY` (default 1) has to match the
deployment: 1 behind one proxy, 0 exposed directly, or any caller picks their
own IP and budget with `X-Forwarded-For`. A limited request gets 429 with
`reason: 'busy'` and `Retry-After`. Unknown `/api` paths get a JSON 404 rather
than the SPA's HTML.

## Fishing report summary

`FishingSummary.jsx` calls `/api/fishing-summary` **when the angler presses the
button** — never on mount, so opening the tab never spends an API call. It fetches the shop and
aggregate pages from `fishingLinks` (`server/fishingSummary.js` imports that
array from `src/data.js`, so the links stay a single source of truth), strips the
HTML to text, and has Claude write one aggregate summary of them. Regulation
links are deliberately excluded — those get read at the source, not paraphrased.

- Fetching happens server-side because the report sites send no CORS headers.
- Results are cached 30 min, and a stale cache (up to 12 h) is served when a
  refresh fails, so one dead source site doesn't blank the card.
- A source that can't be fetched is reported to the client as `unavailable`
  rather than dropped — the card shows it dimmed and still links out.
- **Every linked URL is an archive index** (a contributor, a region, an area),
  so its HTML is a mega-menu wrapped around teasers — the report bodies are not
  on it. `fetchSource` therefore tries `<url>/feed/` first and falls back to the
  page. RSS/Atom are formats rather than one site's markup, so this keeps the
  generic-extraction rule while skipping the chrome entirely.
- The HTML→text pass is deliberately generic (scope to the `<article>`/`<main>`
  landmarks, strip tags, keep paragraph breaks, drop repeated menu lines). Don't
  replace it with site-specific selectors; those break first. Chrome stripping
  removes only the *first* `<header>` — later ones are article headlines, and
  those carry the report's date.
- `npm run fishing:probe` prints what each source actually yields (`feed` vs
  `page`, char count, a preview) without spending an API call. Reach for it
  first when the card reports `no_reports`: if the preview is menus and category
  names, the extraction is what's broken, not the model.
- If the whole call fails, the card degrades to a one-line note pointing at the
  links. Same rule as the briefing: the tab must work with no API key.
- Failures carry a `reason` (`not_configured`, `sources_unreachable`,
  `no_reports`, `busy`, `failed`) that the card turns into a specific next step;
  the client adds `unreachable` when the API server itself doesn't answer. Keep
  that mapping in sync — a generic "something went wrong" is what this replaced.

## Tides

`src/services/noaaTides.js` discovers station ids from NOAA's own metadata API
rather than hardcoding them — a wrong id would silently show another harbour's
tides, which is worse than no tides.

- **`TIDE_STATION_BBOX` in `data.js` bounds which stations are considered**, and
  it reaches east past Nantucket because the destination list does. Widening it
  again means **bumping `STATION_CACHE_KEY`** and adding the old key to
  `LEGACY_STATION_CACHE_KEYS`: the cached list was filtered by the old box, so
  without the bump a new destination resolves to a station in the old region for
  the next thirty days — exactly the silent wrong answer runtime discovery is
  meant to prevent.

- **CO-OPS has two classes of prediction station, and the difference is load-bearing.**
  A *harmonic* (reference) station has tidal constants, so NOAA will serve a
  continuous water level at any interval. A *subordinate* station has none — its
  predictions are a reference station's highs and lows shifted in time and scaled
  in height — so NOAA publishes only `interval=hilo` and **rejects any other
  interval**. Most of the Sound's small harbors are subordinate.
- Therefore the hourly curve request (`fetchCurveRows`) is **optional and must
  stay that way**. Putting it back into the `Promise.all` alongside the extremes
  means every subordinate station's Tides card dies with an error instead of
  showing tides. That was a real bug, not a hypothetical.
- When there's no hourly series, `interpolateCurve` fills the curve in between
  NOAA's extremes with a half cosine — the shape behind the rule of twelfths, so
  it's how a skipper already reads a printed tide table. The payload sets
  `curveInterpolated` and the card says so. Don't drop that flag.
- Predictions deliberately span **today and tomorrow**, so an evening high still
  leaves a "next high" to show. That means the extremes list holds two of
  everything and needs its day headings, and `TideChart` windows to the day
  around now rather than squeezing 48 hours into 320px.
- **Next high, next low and rising are read at render**, with
  `tideStateAt(extremes)`, never stored in the payload. The panels stay open at
  the helm for hours, and a "next high" worked out at fetch time was still
  showing the morning's high in the afternoon. The same goes for the sea state's
  wind-against-tide and the Fishing tab's bite window, which re-render on a
  30 s tick; `useConditions` also refetches every ten minutes while visible.
- Errors arrive as HTTP 200 with an `{ error: { message } }` body, which is why
  `coopsJson` checks the body and not just the status.
- `npm run tides:probe` prints, per dropdown location, which station it resolves
  to, whether that station is harmonic or subordinate, and whether `hilo` and `h`
  actually return rows. Reach for it first when a Tides card errors.
- **Known limitation:** `LIS_BBOX` reaches into the Hudson, the East River and the
  south shore of Long Island, and `pickNearestStation` measures straight-line
  distance with no regard for land in between. No current dropdown entry
  misresolves, but a GPS fix near the west end can.

## Sea state estimate

There is no live buoy reader — the Sea State card is always computed,
client-side, by `estimateWindWaves` in `src/services/forecast.js`. It takes the
real Open-Meteo wind reading, never a guess at wind, and turns it into a
significant wave height and period with the simplified SMB fetch-limited
relations, using an elliptical fetch model of the water it is standing in.

- **Fetch geometry is per water body** (`WATER_BODIES` in `forecast.js`), picked
  from the position by bounding box, falling back to the nearest body's centre.
  A body whose water sits inside an earlier one's box has an `outline` polygon,
  checked before any box: Peconic and Gardiners Bay inside the Sound's, and
  Buzzards Bay, whose box reached across the Elizabeth Islands and gave Woods
  Hole and Tarpaulin Cove its flood rule.
  The Sound's 60 km of fetch cannot be reused off Nantucket, where a southerly
  has the whole Atlantic behind it; `estimateWindWaves` called without a position
  still answers for the Sound, which is what it always answered for.
- **`floodSetDeg` is null wherever the current isn't a simple along-axis rule**,
  which skips the wind-against-tide adjustment rather than inventing a phase.
  Vineyard and Nantucket Sound are null for that reason — the tide there is about
  three hours out of phase with Buzzards Bay and reverses through the holes.

`ConditionsPanel.jsx` also passes it the real tide payload from `fetchTides`
(`src/services/noaaTides.js`), which layers on a wind-against-tide adjustment
wherever the water body declares a flood direction:

- **In the Sound, current is assumed to run along the Sound's axis** — flood
  (rising) sets west, into the Sound from the ocean at its eastern end; ebb
  (falling) sets east, back out. This is a simplification (it reverses near the
  Hell Gate node at the western end) but matches what boaters see on the open
  Sound, and reuses the same axis the fetch model already assumes. Narragansett
  Bay floods north up the bay, Buzzards Bay north-east up the bay.
- **Current strength is modelled as a sine wave between tide extremes** — slack
  (0) at a high or low, maximum at the midpoint between them — because a simple
  harmonic tide's current is the rate of change of its height, which peaks
  exactly halfway between extremes.
- Wind blowing the same way the current is setting eases the estimate (longer,
  flatter sea); wind blowing into the current steepens it (shorter, higher sea).
  Both are capped modest (`WIND_AGAINST_TIDE_HEIGHT` / `_PERIOD`) since this
  rides on top of an already-approximate wind estimate.
- The 7-day wind outlook (`dailyOutlook` in `ConditionsPanel.jsx`) calls
  `estimateWindWaves` **without** a tide argument — NOAA's predictions only
  reach a day or two out, not the whole week the outlook shows, so days beyond
  that get the plain wind estimate rather than a fabricated tide phase.

Never present these numbers as a measurement — the card always labels them
"Estimated," and `estimateWindWaves` returns `estimated: true` for exactly that
reason.

## Marine alerts

NWS answers a point query with the zones that point sits in, and issues the
Small Craft Advisory for a marine zone. A marina's coordinates are at the dock,
which can fall in the land zone, so `fetchMarineAlerts` also asks about a `water`
point, the harbor's approach, and merges the two. A GPS fix within 3 NM of a
charted harbor borrows its approach.

## Offline

`public/sw.js` caches the app shell. The built JS and CSS have hashed names, so
at install it reads them out of the cached `index.html` rather than a list;
without that the first visit, whose files load before the worker is in control,
left nothing to run offline. `/assets/` is served cache-first (a hashed file
never changes), everything else network-first, `/api/` never cached. Caching a
new page prunes `/assets/` files it no longer names.

The depth grid (`/depth-grid.bin`, a megabyte and a half of gzip) is in the shell list,
since a planner that opens with no signal but can't plan is no use at the helm.
The page fetches it when a destination is picked, not on load, and
`loadDepthGrid` unpacks the gzip itself with `DecompressionStream`, unless a
host has already sent it with `Content-Encoding` and the browser did. It is
named `.bin`, not `.gz`, so hosts are less tempted to.

## Conventions

- ES modules, function components, hooks only. No class components.
- Keep `utils.js` free of React imports so the math stays testable.
- In `useConditions`, the code after `await Promise.allSettled(...)` must decide
  what to cache from what the settle callbacks produced, **not** by reading state
  back through a ref. React renders those updates in a later task, so a ref
  assigned during render still holds the `loading` pass at that point — which is
  how the conditions cache silently stored nothing for a while.
- Two-space indent, no semicolons, single quotes — match surrounding code.
- Comments in this codebase explain *nautical reasoning* (why dry cells are
  allowed a quarter mile from a dock, why iOS needs a warm-up geolocation
  call), not what the code does. Follow that.
- `.env` is gitignored; never commit an API key.
