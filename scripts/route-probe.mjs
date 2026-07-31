#!/usr/bin/env node
// What the router actually does, without opening the app.
//
// The channel graph is hand-placed geometry, and the failure mode is a route
// that looks plausible and runs over an island. This prints the things that are
// checkable without a chart:
//
//   1. graph health — waypoints the router cannot reach, usually a typo in a
//      branch's `from` or `to`
//   2. keep-out collisions — a headland circle or shoal circle sitting on a
//      channel leg or an approach waypoint, which makes every transit past it
//      detour for nothing
//   3. routes — distance, the ratio against the straight line, and the legs, so
//      a dog-leg or an absurd detour shows up as a number
//
// Usage:
//   npm run route:probe                     # graph checks + a standing sample
//   npm run route:probe -- stamford nantucket   # one pair, leg by leg
//   npm run route:probe -- --all            # every pair between regions (slow)

import {
  marinas, navigationSpine, navigationBranches, shoalAreas, headlands,
} from '../src/data.js'
import {
  buildChannelGraph, planRoute, calcDistanceNM, calcRouteDistanceNM,
} from '../src/utils.js'

const DRAFT_FT = 3
const args = process.argv.slice(2)

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

const place = (id) => marinas.find((m) => m.id === id)
const approachOf = (p) => p.approach || { lat: p.lat, lng: p.lng }
const nm = (n) => `${n.toFixed(1)} NM`

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
for (const shoal of shoalAreas) {
  if (shoal.minDepthFt < DRAFT_FT + 2) checkCircle(shoal, SHOAL_BUFFER_NM, 'shoal')
}
if (warnings === 0) console.log('  all clear')

// ── 3. routes ──────────────────────────────────────────────────────────────
function report(startId, destId, verbose) {
  const start = place(startId)
  const dest = place(destId)
  if (!start || !dest) {
    fail(`unknown place: ${!start ? startId : destId}`)
    return
  }

  const { waypoints, shoalsAvoided } = planRoute(start, dest, {
    spine: navigationSpine,
    branches: navigationBranches,
    headlands,
    shoals: shoalAreas,
    draftFt: DRAFT_FT,
  })
  const landAvoided = []

  const routeNM = calcRouteDistanceNM(waypoints)
  const directNM = calcDistanceNM(start.lat, start.lng, dest.lat, dest.lng)
  const ratio = directNM > 0 ? routeNM / directNM : 1
  const flag = ratio > RATIO_WARN ? '  <-- long way round?' : ''

  console.log(
    `  ${startId} -> ${destId}: ${nm(routeNM)} (direct ${nm(directNM)}, x${ratio.toFixed(2)}), ` +
    `${waypoints.length} waypoints${flag}`
  )
  const notes = [...landAvoided, ...shoalsAvoided].map((a) => a.name)
  if (notes.length > 0) console.log(`      avoiding: ${notes.join(', ')}`)

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
