#!/usr/bin/env node
// What the router actually does, without opening the app.
//
// The channel graph is hand-placed geometry, and the failure mode is a route
// that looks plausible and runs over an island. This prints the things that are
// checkable without a chart:
//
//   1. graph health: waypoints the router cannot reach, usually a typo in a
//      branch's `from` or `to`
//   2. keep-out collisions: a headland circle or shoal circle sitting on a
//      channel leg or an approach waypoint, which makes every transit past it
//      detour for nothing
//   3. coastline: a channel waypoint, approach, or headland bypass that sits on
//      land, or a channel leg that runs over it, checked against real shoreline
//      (src/coastline.js) rather than the circles the router was drawn with
//   4. routes: distance, the ratio against the straight line, and the legs, so
//      a dog-leg or an absurd detour shows up as a number, plus any leg that
//      runs over land or across a shoal too shallow for the draft
//
// Usage:
//   npm run route:probe                     # graph checks + a standing sample
//   npm run route:probe -- stamford nantucket   # one pair, leg by leg
//   npm run route:probe -- --all            # every pair between regions (slow)
//   npm run route:probe -- --land           # every pair of places, land and shoals only (slow)
//   npm run route:probe -- --land --draft 6 # the same for a deeper boat

import {
  marinas, navigationSpine, navigationBranches, shoalAreas, headlands,
} from '../src/data.js'
import {
  buildChannelGraph, buildRouteWaypoints, calcDistanceNM, calcRouteDistanceNM,
  applyLandAvoidance, applyShoalAvoidance, KEEL_CLEARANCE_FT,
} from '../src/utils.js'
import { coastline, SHORE_ERROR_NM } from '../src/coastline.js'

// A shoal only turns a route when it is too shallow for the boat, so one draft
// only exercises some of them: a runabout never meets most of the reefs a keel
// boat has to be taken round.
const argv = process.argv.slice(2)
const draftFlag = argv.indexOf('--draft')
const DRAFT_FT = draftFlag === -1 ? 3 : Number(argv[draftFlag + 1])
const args = draftFlag === -1 ? argv : [...argv.slice(0, draftFlag), ...argv.slice(draftFlag + 2)]
if (!(DRAFT_FT >= 0)) {
  console.error('--draft takes a draft in feet, e.g. --draft 6')
  process.exit(2)
}
const activeShoals = shoalAreas.filter((s) => s.minDepthFt < DRAFT_FT + KEEL_CLEARANCE_FT)

// Sample runs worth watching: one inside each new region, and the long ones that
// have to cross several of them.
const SAMPLE_PAIRS = [
  ['stamford', 'port-jefferson'],
  ['stamford', 'norwalk'],
  ['norwalk', 'huntington'],
  ['new-london', 'greenport'],
  ['orient-point', 'greenport'],
  ['greenport', 'sag-harbor'],
  ['sag-harbor', 'dering-harbor'],
  ['montauk', 'sag-harbor'],
  ['montauk', 'block-island-new'],
  ['watch-hill', 'block-island-new'],
  ['block-island-new', 'newport'],
  ['newport', 'wickford'],
  ['newport', 'bristol'],
  ['newport', 'east-greenwich'],
  ['sakonnet', 'bristol'],
  ['newport', 'cuttyhunk'],
  ['cuttyhunk', 'new-bedford'],
  ['cuttyhunk', 'menemsha'],
  ['cuttyhunk', 'vineyard-haven'],
  ['new-bedford', 'vineyard-haven'],
  ['padanaram', 'oak-bluffs'],
  ['marion', 'woods-hole'],
  ['woods-hole', 'edgartown'],
  ['vineyard-haven', 'nantucket'],
  ['edgartown', 'nantucket'],
  ['hyannis', 'nantucket'],
  ['stamford', 'newport'],
  ['stamford', 'nantucket'],
  ['mystic', 'nantucket'],
  ['city-island', 'block-island-new'],
]

const RATIO_WARN = 1.6

// The dock end of a route runs up an inner harbor the 100 m shoreline doesn't
// resolve: Point Judith Pond, Lloyd Harbor, the basins behind the jetties. So on
// those two legs the dock end is let off and only a real stretch over land
// counts, like the old straight line up the Connecticut River to Essex.
const HARBOR_GRACE_NM = 0.25
const HARBOR_RUN_NM = 0.25

const place = (id) => marinas.find((m) => m.id === id)
const approachOf = (p) => p.approach || { lat: p.lat, lng: p.lng }
const nm = (n) => `${n.toFixed(1)} NM`
const nm2 = (n) => `${n.toFixed(2)} NM`
const at = (p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`

// The shoreline has no rivers, so a river branch (the Connecticut up to Essex)
// is land to it. Its waypoints, and any approach placed on one, are excused from
// the coastline checks; route:probe says so rather than passing them silently.
const riverPoints = navigationBranches
  .filter((branch) => branch.river)
  .flatMap((branch) => branch.waypoints)
const onRiver = (p) => riverPoints.some((w) => calcDistanceNM(p.lat, p.lng, w.lat, w.lng) < 0.25)

function routeFor(start, dest) {
  const base = buildRouteWaypoints(start, dest, navigationSpine, navigationBranches, headlands, coastline)
  const { waypoints: landClear, avoided: landAvoided } = applyLandAvoidance(base, headlands)
  const { waypoints, avoided: shoalsAvoided, unavoided } = applyShoalAvoidance(landClear, shoalAreas, DRAFT_FT, { coast: coastline })
  return { waypoints, avoided: [...landAvoided, ...shoalsAvoided], unavoided }
}

// Closest a straight leg comes to a point, in NM, on a flat projection: legs are
// a few miles long, well inside where that matters.
function legDistanceNM(p, a, b) {
  const cosLat = Math.cos((p.lat * Math.PI) / 180)
  const ax = (a.lng - p.lng) * 60 * cosLat
  const ay = (a.lat - p.lat) * 60
  const dx = (b.lng - a.lng) * 60 * cosLat
  const dy = (b.lat - a.lat) * 60
  const lenSq = dx * dx + dy * dy
  const t = lenSq ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

// Shoal circles are drawn to a few hundred yards, so a leg that only grazes the
// edge of one is inside that error rather than across the shoal. This is the
// same slack the router gives a leg's ends (ENDPOINT_SLACK_NM in utils.js): the
// channel out of the Connecticut River runs down the edge of Long Sand Shoal.
const SHOAL_GRAZE_NM = 0.05

// Every middle leg that crosses a shoal too shallow for the probe's draft. The
// harbor legs are curated and a shoal round an approach is section 2's to
// report (a lighthouse on a reef has its approach there on purpose), so a shoal
// holding either approach is left out.
function shoalsOnRoute(waypoints) {
  const ends = [waypoints[1], waypoints[waypoints.length - 2]].map(([lat, lng]) => ({ lat, lng }))
  const issues = []
  for (const shoal of activeShoals) {
    if (ends.some((p) => calcDistanceNM(p.lat, p.lng, shoal.lat, shoal.lng) < shoal.radiusNM)) continue
    for (let i = 1; i < waypoints.length - 2; i++) {
      const a = { lat: waypoints[i][0], lng: waypoints[i][1] }
      const b = { lat: waypoints[i + 1][0], lng: waypoints[i + 1][1] }
      const d = legDistanceNM(shoal, a, b)
      if (d < shoal.radiusNM - SHOAL_GRAZE_NM) issues.push({ leg: i + 1, a, b, shoal, d })
    }
  }
  return issues
}

const describeShoal = (issue) =>
  `leg ${issue.leg} ${at(issue.a)} -> ${at(issue.b)} crosses ${issue.shoal.id} ` +
  `(${issue.shoal.minDepthFt} ft, ${nm2(issue.d)} from its centre, radius ${nm2(issue.shoal.radiusNM)})`

// Every leg of a route that runs over land. The middle legs are the router's
// own work and any land on them is a failure; the first and last are the
// curated harbor legs, judged with the dock end let off (see HARBOR_GRACE_NM).
// Routes share most of their legs, so --land would walk the same one thousands
// of times without this.
const landCache = new Map()
function landOnLeg(a, b, harborLeg) {
  const key = `${a.lat},${a.lng},${b.lat},${b.lng},${harborLeg}`
  if (!landCache.has(key)) landCache.set(key, coastline.landAlong(a, b, harborLeg ? { graceNM: HARBOR_GRACE_NM } : {}))
  return landCache.get(key)
}

function landOnRoute(waypoints) {
  const issues = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = { lat: waypoints[i][0], lng: waypoints[i][1] }
    const b = { lat: waypoints[i + 1][0], lng: waypoints[i + 1][1] }
    const harborLeg = i === 0 || i === waypoints.length - 2
    if ((onRiver(a) && onRiver(b)) || (harborLeg && (onRiver(a) || onRiver(b)))) continue
    const found = landOnLeg(a, b, harborLeg)
    if (!found || (harborLeg && found.longestNM < HARBOR_RUN_NM)) continue
    issues.push({ leg: i + 1, harborLeg, a, b, ...found })
  }
  return issues
}

const describeLand = (issue) =>
  `leg ${issue.leg} ${at(issue.a)} -> ${at(issue.b)} runs ${nm2(issue.longestNM)} over land ` +
  `(${nm2(issue.deepestNM)} inland at ${at(issue.at)})`

// Two severities. A graph that can't be walked is broken and fails the probe; a
// keep-out circle overlapping something is a warning, because some of them are
// meant to (a lighthouse on a reef has its approach on the reef).
let problems = 0
let warnings = 0
const fail = (line) => {
  problems += 1
  console.log(`  ! ${line}`)
}
const warn = (line) => {
  warnings += 1
  console.log(`  ? ${line}`)
}

// ── 1. graph health ────────────────────────────────────────────────────────
console.log('\nChannel graph')
const graph = buildChannelGraph(navigationSpine, navigationBranches)
console.log(`  ${graph.nodes.length} waypoints, ${graph.legs.length} legs`)

const ids = new Set(graph.nodes.map((n) => n.id))
for (const branch of navigationBranches) {
  if (!ids.has(branch.from)) fail(`${branch.id}: from "${branch.from}" is not a waypoint`)
  if (branch.to != null && !ids.has(branch.to)) fail(`${branch.id}: to "${branch.to}" is not a waypoint`)
}

// Everything has to be reachable from the west end of the Sound.
const seen = new Set([0])
const queue = [0]
while (queue.length > 0) {
  const u = queue.shift()
  for (const edge of graph.adj[u]) {
    if (!seen.has(edge.to)) {
      seen.add(edge.to)
      queue.push(edge.to)
    }
  }
}
for (let i = 0; i < graph.nodes.length; i++) {
  if (!seen.has(i)) fail(`waypoint ${graph.nodes[i].id} is unreachable from the spine`)
}

// ── 2. keep-out collisions ─────────────────────────────────────────────────
// A land or shoal circle that covers a channel waypoint, or an approach
// waypoint, makes the avoidance passes fire on routes that are already fine.
console.log('\nKeep-out clearances')
const LAND_BUFFER_NM = 0.3   // applyLandAvoidance
const SHOAL_BUFFER_NM = 0.25 // applyShoalAvoidance

const checkCircle = (circle, buffer, label) => {
  const threshold = circle.radiusNM + buffer
  for (const node of graph.nodes) {
    const d = calcDistanceNM(circle.lat, circle.lng, node.lat, node.lng)
    if (d < threshold) warn(`${label} ${circle.id} covers channel waypoint ${node.id} (${nm(d)} < ${nm(threshold)})`)
  }
  for (const p of marinas) {
    // A lighthouse marks a danger, so its approach sits on that danger on
    // purpose — and the marina-to-approach leg is exempt from detouring anyway.
    if (p.kind === 'landmark') continue
    const a = approachOf(p)
    const d = calcDistanceNM(circle.lat, circle.lng, a.lat, a.lng)
    if (d < threshold) warn(`${label} ${circle.id} covers the approach to ${p.id} (${nm(d)} < ${nm(threshold)})`)
  }
}

for (const land of headlands) checkCircle(land, LAND_BUFFER_NM, 'headland')
// Only shoals shallow enough to matter to the probe's draft can force a detour.
for (const shoal of activeShoals) checkCircle(shoal, SHOAL_BUFFER_NM, 'shoal')
if (warnings === 0) console.log('  all clear')

// ── 3. coastline ───────────────────────────────────────────────────────────
// Only land further inside than the shoreline's own 100 m error counts, so a
// waypoint placed tight under a breakwater is not reported as sitting on it.
console.log('\nCoastline')
const problemsBefore = problems
const inland = (p) => coastline.inlandNM(p.lat, p.lng)
for (const node of graph.nodes) {
  if (onRiver(node)) continue
  const depth = inland(node)
  if (depth > SHORE_ERROR_NM) fail(`channel waypoint ${node.id} is on land, ${nm2(depth)} inland`)
}
for (const leg of graph.legs) {
  if (onRiver(leg.a) && onRiver(leg.b)) continue
  const found = coastline.landAlong(leg.a, leg.b)
  if (found) {
    fail(`channel leg ${leg.a.id} -> ${leg.b.id} runs ${nm2(found.longestNM)} over land (${nm2(found.deepestNM)} inland at ${at(found.at)})`)
  }
}
for (const p of marinas) {
  if (p.approach && onRiver(p.approach)) continue
  const depth = p.approach ? inland(p.approach) : 0
  if (depth > SHORE_ERROR_NM) fail(`the approach to ${p.id} is on land, ${nm2(depth)} inland`)
}
for (const land of headlands) {
  const depth = land.bypass ? inland(land.bypass) : 0
  if (depth > SHORE_ERROR_NM) fail(`the bypass for ${land.id} is on land, ${nm2(depth)} inland`)
}
if (problems === problemsBefore) console.log('  every waypoint, approach, bypass and channel leg is on the water')
if (riverPoints.length > 0) console.log(`  (${riverPoints.length} river waypoints not checked: the shoreline has no rivers)`)

// ── 4. routes ──────────────────────────────────────────────────────────────
function report(startId, destId, verbose) {
  const start = place(startId)
  const dest = place(destId)
  if (!start || !dest) {
    fail(`unknown place: ${!start ? startId : destId}`)
    return
  }

  const { waypoints, avoided, unavoided } = routeFor(start, dest)

  const routeNM = calcRouteDistanceNM(waypoints)
  const directNM = calcDistanceNM(start.lat, start.lng, dest.lat, dest.lng)
  const ratio = directNM > 0 ? routeNM / directNM : 1
  const flag = ratio > RATIO_WARN ? '  <-- long way round?' : ''

  console.log(
    `  ${startId} -> ${destId}: ${nm(routeNM)} (direct ${nm(directNM)}, x${ratio.toFixed(2)}), ` +
    `${waypoints.length} waypoints${flag}`
  )
  const notes = avoided.map((a) => a.name)
  if (notes.length > 0) console.log(`      avoiding: ${notes.join(', ')}`)
  if (unavoided.length > 0) console.log(`      no way round: ${unavoided.map((s) => s.name).join(', ')}`)
  for (const issue of landOnRoute(waypoints)) {
    if (issue.harborLeg) warn(`${startId} -> ${destId}: harbor ${describeLand(issue)}`)
    else fail(`${startId} -> ${destId}: ${describeLand(issue)}`)
  }
  for (const issue of shoalsOnRoute(waypoints)) fail(`${startId} -> ${destId}: ${describeShoal(issue)}`)

  if (verbose) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [aLat, aLng] = waypoints[i]
      const [bLat, bLng] = waypoints[i + 1]
      console.log(
        `      leg ${String(i + 1).padStart(2)}: ${aLat.toFixed(3)},${aLng.toFixed(3)} -> ` +
        `${bLat.toFixed(3)},${bLng.toFixed(3)}  ${nm(calcDistanceNM(aLat, aLng, bLat, bLng))}`
      )
    }
  }
}

if (args.length === 2 && !args[0].startsWith('--')) {
  console.log('\nRoute')
  report(args[0], args[1], true)
} else if (args[0] === '--all') {
  console.log('\nAll cross-region pairs')
  const harbors = marinas.filter((m) => !m.kind)
  for (let i = 0; i < harbors.length; i++) {
    for (let j = i + 1; j < harbors.length; j++) {
      if (harbors[i].region === harbors[j].region) continue
      report(harbors[i].id, harbors[j].id, false)
    }
  }
} else if (args[0] === '--land') {
  // Every ordered pair, since the router does not treat A->B and B->A alike.
  // Quiet unless something runs over land or a shoal, and grouped by the
  // offending leg: one bad waypoint shows up in hundreds of routes.
  console.log(`\nEvery pair of places, land and ${DRAFT_FT} ft shoal check only`)
  const groups = new Map()
  let routes = 0
  let failing = 0
  const note = (key, issue, kind, pair) => {
    if (!groups.has(key)) groups.set(key, { issue, kind, pairs: [] })
    groups.get(key).pairs.push(pair)
  }
  // The planner runs this on a phone at the helm, so the slowest route matters
  // as much as the failures do.
  let slowest = { ms: 0, pair: '' }
  for (const start of marinas) {
    for (const dest of marinas) {
      if (start.id === dest.id) continue
      routes += 1
      const pair = `${start.id} -> ${dest.id}`
      const t0 = performance.now()
      const { waypoints } = routeFor(start, dest)
      const ms = performance.now() - t0
      if (ms > slowest.ms) slowest = { ms, pair }
      const land = landOnRoute(waypoints)
      const shoals = shoalsOnRoute(waypoints)
      if (land.some((issue) => !issue.harborLeg) || shoals.length > 0) failing += 1
      for (const issue of land) {
        const kind = issue.harborLeg ? 'harbor' : 'land'
        note(`${kind} ${at(issue.a)} -> ${at(issue.b)}`, issue, kind, pair)
      }
      for (const issue of shoals) note(`shoal ${issue.shoal.id} ${at(issue.a)} -> ${at(issue.b)}`, issue, 'shoal', pair)
    }
  }
  const sorted = [...groups.values()].sort((x, y) => y.pairs.length - x.pairs.length)
  for (const { issue, kind, pairs } of sorted) {
    const what = kind === 'shoal' ? describeShoal(issue) : describeLand(issue)
    const line = `${kind === 'harbor' ? 'harbor ' : ''}${what.replace(/^leg \d+ /, 'leg ')}, ` +
      `${pairs.length} route(s), e.g. ${pairs.slice(0, 2).join('; ')}`
    if (kind === 'harbor') warn(line)
    else fail(line)
  }
  console.log(`  ${failing} of ${routes} routes cross land or a shoal between their approaches`)
  console.log(`  slowest route to plan: ${slowest.pair}, ${Math.round(slowest.ms)} ms`)
} else {
  console.log('\nSample routes')
  for (const [a, b] of SAMPLE_PAIRS) report(a, b, false)
}

console.log(
  problems === 0
    ? `\nGraph is sound. ${warnings} clearance warning(s).\n`
    : `\n${problems} problem(s), ${warnings} clearance warning(s).\n`
)
if (problems > 0) process.exitCode = 1
