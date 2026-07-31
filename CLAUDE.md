# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this app is

A single-page **southern New England boating trip planner**, home waters Long
Island Sound. The user picks a start and destination, enters boat specs (tank
size, cruising speed, fuel burn, draft), and gets back distance, travel time,
fuel usage, no-wake-zone delays, draft/shoal warnings, and nearby points of
interest — plotted over a NOAA nautical chart.

Destinations run west to east through six regions: Long Island Sound, Peconic &
Gardiners Bay, Block Island & Rhode Island Sound, Narragansett Bay, Buzzards Bay,
and Vineyard & Nantucket Sound. The Sound is still the centre of gravity — the
default view, the fishing links and the species calendar are all Sound-specific.

There is no database. All navigation data is hardcoded in `src/data.js`, and
every navigation calculation happens client-side. The only server (`server/`) is
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

npm run tides:probe    # which NOAA station each location resolves to
npm run fishing:probe  # what each fishing source actually yields
npm run route:probe    # graph health, keep-out clearances, and sample routes
npm run route:audit    # does any planned route cross land?
npm run landmask:build # regenerate the coastline bitmap from OSM data
```

`route:probe` takes a pair (`npm run route:probe -- newport cuttyhunk`) to print
one route leg by leg, or `-- --all` for every cross-region pair.

**`route:audit` is the one that guards the important invariant.** It plans every
pair of places — about 4,750 of them — and walks each leg against the coastline
bitmap. It must report zero open-water legs crossing land; treat any failure as
a bug in the router or in the place's coordinates, not as noise. It takes a pair
(`npm run route:audit -- stamford greenwich`) to print one route leg by leg with
each leg's verdict.

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
src/App.css           All styling (~1100 lines), CSS vars in :root
src/data.js           Places, navigation spine + branches, shoals, headlands, no-wake zones, POIs
src/utils.js          Pure navigation/fuel math — no React
src/landMask.generated.js   GENERATED coastline bitmap (npm run landmask:build)
src/services/landMask.js    Land/water lookups; the one land-crossing test
src/services/waterRouter.js A* over the water, and the direct-course check
src/hooks/useTripCalculator.js   Owns all form state, orchestrates utils.js
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
```

**Where to make a change:**

- New marina / shoal / no-wake zone / POI → `src/data.js` only. A place in water
  the channel graph doesn't reach needs a branch there too — then
  `npm run route:probe` to see what the router does with it.
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
- **The route is searched over the real coastline, and it must stay in water.**
  `planRoute` in `utils.js` is the single entry point. Between the two approach
  waypoints it takes the straight course when that course is clear, and
  otherwise runs A* over the water (`services/waterRouter.js`). This replaced a
  channel graph guarded by a dozen keep-out circles, under which **three
  quarters of all place pairs came back with a course drawn over land** — the
  circles covered Eatons Neck, Lloyd Neck and the Elizabeth Islands, and nothing
  along the Connecticut shore where most trips happen. `route:audit` is what
  keeps that from coming back.
- **`segmentHitsLand` in `services/landMask.js` is the only land-crossing
  test.** The router plans against it and the audit checks against it, so the
  two cannot disagree. An earlier attempt had the router consulting its own
  coarser grid, which quietly passed courses over Stratford Point while the
  audit called them clear. Do not add a second land test.
  - It visits **every cell** the course touches rather than sampling points
    along it — a sampled walk slips between two diagonally touching specks of
    land — and it runs between the **true positions**, not the centres of the
    cells they fall in, because half a cell of error at each end swings the
    middle of a long leg by a whole cell.
- **The search grid is deliberately permissive; the mask is what clears a
  course.** `waterRouter` searches a 2x-downsampled grid where a cell counts as
  passable if any of its fine cells is water. That is only safe because **a step
  between two cells is rejected unless the course between them is clear on the
  fine mask** — so the path is water-only by construction. Making the grid
  itself strict (all four fine cells water) instead seals every channel under
  ~360 m: upper Narragansett Bay became an isolated pond and every route to East
  Greenwich fell back to the old graph, which is exactly the thing that draws
  courses over land.
- **A course that cannot reach its goal ends at the nearest water it could
  reach**, and the last stretch into the harbor is curated data. Failing instead
  would fall back to the channel graph, and a course over land is worse than a
  course that stops short.
- **The route is water-checked, not channel-checked, and the app says so.** It
  carries no aids-to-navigation data — no buoy positions, no channel
  centrelines — so a plotted course can lie outside the marked channel. The
  Sidebar shows a standing advisory on every route saying exactly that and
  pointing at the OpenSeaMap marks layer, which is where the real buoys are.
  Do not remove it without adding the data that would make it untrue.
- **A shortest path is not a course.** Left alone it shaves every headland:
  routes were coming back with 300 ft of shore clearance, which is water but is
  not water anyone steers. Two things fix that, and both matter —
  `standoffMultiplier` makes the search pay to stand off the beach, and
  `furthestClearTarget` takes each shortcut at the most generous offing in
  `SHORTCUT_CLEARANCES` that still allows one. Straightening the path on a plain
  land check undoes all of it.
  - Clearance is read off the distance-to-land field, not by testing a padded
    box at each step along the chord — the box is `(2p+1)²` lookups per step and
    put a long route into seconds of work.
  - That field is seeded from cells with *no* land in them, not from the
    permissive search grid. Measuring clearance from cells that are three
    quarters beach tells the route it has room where it has none.
- **The channel graph is now only a fallback** for a position outside the
  coastline box. `navigationSpine`, `navigationBranches` and their per-waypoint
  `corridorNM` still describe where the deep water runs, and `route:probe` still
  checks the graph's health, but they no longer decide a normal route.
- **`headlands` no longer decides what is land** — the coastline mask does. The
  circles survive for their curated `bypass` points, used only on the fallback
  path.
- **A place's coordinates are load-bearing, and the audit will catch a bad one.**
  Glen Cove sat at -73.629, a mile and a half inland on the wrong side of the
  neck, and produced 97 audit failures on its own. If `route:audit` reports one
  place failing against everything, suspect its `lat`/`lng`/`approach` before
  suspecting the router.
- **Marinas have an `approach` waypoint** — an open-water point outside the
  harbor entrance. Routing runs between approach points; the marina coordinates
  are only the first and last legs. Any new marina needs a sane `approach`,
  a `region`, and `approachDepthFt` (controlling depth at MLW) *if* a published
  controlling depth exists — the draft check is skipped when it is absent, which
  is the honest outcome for an open roadstead. Put the approach outside any
  headland or shoal circle unless the place *is* the hazard (a lighthouse).
- **The Cape Cod Canal is still not modelled.** It is narrower than the
  coastline mask can resolve, so the search cannot get through it: a course from
  Buzzards Bay to Cape Cod Bay comes back as 105 NM around the outside of the
  Cape rather than 6 NM through the cut. That is the same honest answer the old
  router gave — this planner has no canal traffic rules in it — but note it is
  now a consequence of the data rather than a decision. If a Cape Cod Bay
  destination is ever added, this needs deciding on purpose.
- **The Sakonnet River *is* now used**, which is a change. Bristol to New Bedford
  runs down the Sakonnet (37 NM) instead of out around Newport, because the
  search plans over real water and the Sakonnet is real water. It is navigable
  for the powerboats this app plans for, but it is spanned by fixed bridges and
  the app models no air draft — the boat form asks for tank, speed, burn and
  draft, and nothing about height. If that matters, block the passage explicitly
  rather than hoping the mask closes it.
- **Shoal avoidance is draft-dependent, and now happens inside the search.**
  `planRoute` passes the shoals where `minDepthFt < draft + clearance` (default
  2 ft) into the route search as blocked water, so "shortest water course" and
  "deep enough for this boat" are one search rather than two passes that undo
  each other. `applyShoalAvoidance` and `applyLandAvoidance` still exist and
  still run — but **only on the fallback graph route**. Running their bypass
  insertion over a searched course reintroduces land crossings: they push a
  waypoint off a circle's centre with no idea where the shoreline is.
- **Depth beyond the curated shoals is not modelled.** The coastline data says
  where the land is, not how deep the water is. `shoalAreas` and
  `approachDepthFt` are the whole depth model, so a route is "in water" with far
  more confidence than it is "deep enough".
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
  twice in `App.jsx` with identical props.
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

When the key is absent or the request fails, it silently falls back to
`generateFallbackBriefing`, a template-string summary. Keep that fallback
working — the app must be fully usable with no API key.

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

## Conventions

- ES modules, function components, hooks only. No class components.
- Keep `utils.js` free of React imports so the math stays testable.
- In `useConditions`, the code after `await Promise.allSettled(...)` must decide
  what to cache from what the settle callbacks produced, **not** by reading state
  back through a ref. React renders those updates in a later task, so a ref
  assigned during render still holds the `loading` pass at that point — which is
  how the conditions cache silently stored nothing for a while.
- Two-space indent, no semicolons, single quotes — match surrounding code.
- Comments in this codebase explain *nautical reasoning* (why a corridor is 6 NM,
  why iOS needs a warm-up geolocation call), not what the code does. Follow that.
- `.env` is gitignored; never commit an API key.
