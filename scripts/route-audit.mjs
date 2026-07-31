#!/usr/bin/env node
// Does any planned route cross land?
//
// route:probe checks the graph's own health; this checks the thing that
// actually matters at the helm — that the course the app draws stays in the
// water. Every pair of places, both directions collapsed, each leg walked
// against the coastline bitmap.
//
// Usage:
//   npm run route:audit            # every pair, summary + first failures
//   npm run route:audit -- --all   # list every failing pair
//   npm run route:audit -- a b     # one pair, leg by leg

import {
  marinas, navigationSpine, navigationBranches, shoalAreas, headlands,
} from '../src/data.js'
import { planRoute, calcDistanceNM, calcRouteDistanceNM } from '../src/utils.js'
import { segmentHitsLand, isLand, cellSizeNM } from '../src/services/landMask.js'

const DRAFT_FT = 3
const args = process.argv.slice(2)
const showAll = args.includes('--all')
const pair = args.filter((a) => !a.startsWith('--'))

// The margin the audit holds routes to. One cell (~90 m) off the beach is the
// most a plotted course may graze; the router itself aims for more.
const AUDIT_PAD = 0

const place = (id) => marinas.find((m) => m.id === id)
const nm = (n) => `${n.toFixed(1)} NM`

function routeFor(start, dest) {
  return planRoute(start, dest, {
    spine: navigationSpine,
    branches: navigationBranches,
    headlands,
    shoals: shoalAreas,
    draftFt: DRAFT_FT,
  }).waypoints
}

// A route is [dock, approach, ...open water..., approach, dock]. The open water
// between the approaches is the router's work and has to be clear. The harbor
// water at either end is curated data the app is entitled to trust.
//
// How close to a dock or a curated approach waypoint land has to be before it
// counts as harbor rather than a routing mistake. A jettied inlet or a dredged
// river mouth reads as solid land at 90 m cells, so the last half mile into one
// will always trip the mask — but land in the middle of a leg never has an
// innocent explanation, however short the leg or close to a harbor it starts.
const HARBOR_NM = 0.75

function classify(waypoints, start, dest) {
  const curated = [
    [start.lat, start.lng],
    [dest.lat, dest.lng],
    ...(start.approach ? [[start.approach.lat, start.approach.lng]] : []),
    ...(dest.approach ? [[dest.approach.lat, dest.approach.lng]] : []),
  ]
  const nearCurated = (lat, lng) =>
    curated.some((e) => calcDistanceNM(e[0], e[1], lat, lng) <= HARBOR_NM)

  const open = []
  const approach = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    if (!segmentHitsLand(a[0], a[1], b[0], b[1], AUDIT_PAD)) continue

    const lengthNM = calcDistanceNM(a[0], a[1], b[0], b[1])

    // The dock-to-approach legs at either end are the harbor channel itself.
    // Norwalk's runs a mile and a half between breakwaters and dredged spoil;
    // no raster drawn from a coastline will ever call that water, and the app
    // has never claimed to route it — the approach waypoint is where the
    // routing starts.
    if (i === 0 || i === waypoints.length - 2) {
      approach.push({ leg: i + 1, a, b, lengthNM })
      continue
    }

    const steps = Math.max(20, Math.ceil(lengthNM * 60))
    let worst = null
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const lat = a[0] + (b[0] - a[0]) * t
      const lng = a[1] + (b[1] - a[1]) * t
      if (!isLand(lat, lng)) continue
      if (nearCurated(lat, lng)) continue
      const fromStart = calcDistanceNM(a[0], a[1], lat, lng)
      if (!worst || fromStart < worst.intoLegNM) worst = { lat, lng, intoLegNM: fromStart }
    }

    const leg = { leg: i + 1, a, b, lengthNM }
    if (worst) open.push({ ...leg, at: worst })
    else approach.push(leg)
  }
  return { open, approach }
}

if (pair.length === 2) {
  const start = place(pair[0])
  const dest = place(pair[1])
  if (!start || !dest) {
    console.error('unknown place')
    process.exit(1)
  }
  const waypoints = routeFor(start, dest)
  const { open, approach } = classify(waypoints, start, dest)
  const flagged = new Map([...open.map((l) => [l.leg, 'LAND']), ...approach.map((l) => [l.leg, 'land (harbor approach)'])])
  console.log(`\n${pair[0]} -> ${pair[1]}: ${nm(calcRouteDistanceNM(waypoints))}, ${waypoints.length} waypoints`)
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [aLat, aLng] = waypoints[i]
    const [bLat, bLng] = waypoints[i + 1]
    console.log(
      `  leg ${String(i + 1).padStart(2)}: ${aLat.toFixed(4)},${aLng.toFixed(4)} -> ${bLat.toFixed(4)},${bLng.toFixed(4)}` +
      `  ${nm(calcDistanceNM(aLat, aLng, bLat, bLng)).padStart(8)}` +
      `  ${flagged.get(i + 1) || 'water'}`
    )
  }
  process.exit(0)
}

console.log(`\nCoastline cell ~${(cellSizeNM() * 1852).toFixed(0)} m`)

// Sanity: the mask has to agree with the chart on a few knowns before its
// verdict on 4000 routes means anything.
const KNOWN = [
  ['mid Long Island Sound', 41.10, -73.00, false],
  ['mid Block Island Sound', 41.20, -71.60, false],
  ['mid Vineyard Sound', 41.42, -70.74, false],
  ['Long Island at Riverhead', 40.92, -72.66, true],
  ['Connecticut at Norwalk', 41.13, -73.42, true],
  ['Block Island interior', 41.17, -71.58, true],
  ['Nantucket interior', 41.28, -70.10, true],
  ['Naushon Island', 41.487, -70.748, true],
  ['Shippan Point, Stamford', 41.025, -73.525, true],
]
let maskBad = 0
for (const [name, lat, lng, want] of KNOWN) {
  const got = isLand(lat, lng)
  if (got !== want) {
    maskBad++
    console.log(`  ! mask disagrees at ${name}: land=${got}, expected ${want}`)
  }
}
console.log(maskBad === 0 ? '  mask sanity checks pass' : `  ${maskBad} mask sanity failure(s)`)

const places = marinas
let pairs = 0
let clean = 0
const failures = []
let approachLegs = 0

for (let i = 0; i < places.length; i++) {
  for (let j = i + 1; j < places.length; j++) {
    const waypoints = routeFor(places[i], places[j])
    pairs++
    const { open, approach } = classify(waypoints, places[i], places[j])
    if (open.length === 0) clean++
    else failures.push({ a: places[i].id, b: places[j].id, hits: open })
    approachLegs += approach.length
  }
}

console.log(`\n${pairs} pairs audited`)
console.log(`  ${clean} keep the open-water course in the water`)
console.log(`  ${failures.length} cross land on an open-water leg`)

const show = showAll ? failures : failures.slice(0, 25)
for (const f of show) {
  const legs = f.hits.map((h) => `leg ${h.leg} ${nm(h.lengthNM)} — land at ${h.at.lat.toFixed(3)},${h.at.lng.toFixed(3)} (${nm(h.at.intoLegNM)} in)`)
  console.log(`  ! ${f.a} -> ${f.b}: ${legs.join('; ')}`)
}
if (!showAll && failures.length > show.length) {
  console.log(`  … and ${failures.length - show.length} more (pass --all to list them)`)
}

// Land within a harbor's own water is expected and not counted above — the
// mask cannot draw a dredged channel — but it is worth knowing how much of the
// audit rests on that exemption.
console.log(`\n  ${approachLegs} leg(s) touch land only inside ${HARBOR_NM} NM of a dock or approach waypoint (harbor water, not audited)`)

console.log()
if (failures.length > 0) process.exitCode = 1
