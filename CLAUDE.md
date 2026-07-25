# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this app is

A single-page **Long Island Sound boating trip planner**. The user picks a start
and destination marina, enters boat specs (tank size, cruising speed, fuel burn,
draft), and gets back distance, travel time, fuel usage, no-wake-zone delays,
draft/shoal warnings, and nearby points of interest — plotted over a NOAA
nautical chart.

There is no backend and no database. All navigation data is hardcoded in
`src/data.js`, and every calculation happens client-side.

It is installable as a PWA (`public/manifest.json`, iOS meta tags in
`index.html`) and is expected to be usable on a phone at the helm.

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run preview  # serve the build
```

There are **no tests and no linter configured**. Verify changes by running
`npm run dev` and exercising the UI. If you add tests, wire them into
`package.json` scripts.

## Stack

React 18 + Vite 5, `react-leaflet` v4 / Leaflet 1.9 for mapping,
`@anthropic-ai/sdk` for the optional AI trip briefing. Plain CSS in a single
file — no CSS framework, no TypeScript, no state library.

## Layout

```
index.html            PWA meta tags, manifest link
src/main.jsx          React root
src/App.jsx           Tab state + desktop/mobile layouts + bottom-sheet drag
src/App.css           All styling (~1100 lines), CSS vars in :root
src/data.js           Marinas, navigation spine, shoals, no-wake zones, POIs
src/utils.js          Pure navigation/fuel math — no React
src/hooks/useTripCalculator.js   Owns all form state, orchestrates utils.js
src/components/Sidebar.jsx       Inputs + results panel
src/components/TripMap.jsx       Leaflet map, chart layers, live GPS
src/components/TripBriefing.jsx  Optional Claude-generated briefing
```

**Where to make a change:**

- New marina / shoal / no-wake zone / POI → `src/data.js` only.
- Change how a number is computed → `src/utils.js` (keep functions pure).
- New input or result field → `useTripCalculator.js` + `Sidebar.jsx`.
- Map layers, markers, GPS behavior → `TripMap.jsx`.

## Domain rules that matter

Getting these wrong produces plausible-looking but wrong navigation output.

- **Units are nautical.** Distances in nautical miles, speed in knots, depth in
  feet at MLW, fuel in gallons and GPH. `calcDistanceNM` computes kilometers via
  Haversine and divides by 1.852 — don't "simplify" that away.
- **Routes are not straight lines.** `buildRouteWaypoints` routes via the
  `navigationSpine` in `data.js` (a west-to-east chain of mid-Sound waypoints
  representing safe deep water), then greedily shortcuts any chord that stays
  within `CORRIDOR_NM` (6 NM) of the spine. A direct crossing is only allowed
  when it beats the spine path *and* is either under 10 NM or stays in the
  corridor. These constants exist to keep routes off headlands like Eatons Neck.
- **Marinas have an `approach` waypoint** — an open-water point outside the
  harbor entrance. Routing runs between approach points; the marina coordinates
  are only the first and last legs. Any new marina needs a sane `approach` and
  `approachDepthFt` (controlling depth at MLW).
- **Shoal avoidance is draft-dependent.** `applyShoalAvoidance` only detours
  around hazards where `minDepthFt < draft + clearance` (default 2 ft clearance),
  and it deliberately leaves the first and last legs alone since those are
  curated harbor approaches.
- **No-wake zones cost time and save fuel.** Delay is the difference between
  transit at cruising speed and at the zone's `speedLimit`; fuel in a zone burns
  at 30% of cruise GPH (`calcTripDetails`).
- **The fuel warning threshold is 70%** of tank capacity, used for both the
  sidebar warning and the gauge color.

## UI conventions

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

`TripBriefing.jsx` calls the Anthropic API **directly from the browser** using
`VITE_ANTHROPIC_API_KEY` (see `.env.example`) with `dangerouslyAllowBrowser:
true`. This ships the key to the client, so it is fine for local use only — do
not deploy this publicly with a real key. If briefings need to work in
production, move the call behind a server endpoint.

When the key is absent or the request fails, it silently falls back to
`generateFallbackBriefing`, a template-string summary. Keep that fallback
working — the app must be fully usable with no API key.

## Conventions

- ES modules, function components, hooks only. No class components.
- Keep `utils.js` free of React imports so the math stays testable.
- Two-space indent, no semicolons, single quotes — match surrounding code.
- Comments in this codebase explain *nautical reasoning* (why a corridor is 6 NM,
  why iOS needs a warm-up geolocation call), not what the code does. Follow that.
- `.env` is gitignored; never commit an API key.
