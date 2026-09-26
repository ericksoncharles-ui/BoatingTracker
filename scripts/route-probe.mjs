#!/usr/bin/env node
// What the router actually does, without opening the app.
//
// The router plans on the survey's depths (src/depthGrid.js, src/router.js),
// so the failure modes worth watching are a place whose position isn't where
// its water is, a route that can't be found, one that is slow to find, and
// the router breaking its own rules. This prints:
//
//   1. the depth grid: what it was built from and when
//   2. places: any harbor or anchorage whose position is on a cell the survey
//      has as dry (the router then crosses it to the nearest water, which may
//      be the wrong water), and any approach that is
//   3. closed waters: each box has to sit across water, or it closes nothing
//   4. routes: distance against the straight line, how long it took to plan,
//      the stretches near either end in water shallower than the boat was held
//      to, and every leg walked again cell by cell against the rules: nothing
//      through closed water, shallow water only within reach of an end, dry
//      cells only within the last few hundred yards of one
//
// Usage:
//   npm run route:probe                          # grid, places, a standing sample
//   npm run route:probe -- stamford nantucket    # one route, leg by leg
//   npm run route:probe -- --all                 # every pair of places (a few minutes)
//   npm run route:probe -- --all --draft 6       # the same for a deeper boat

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { marinas, closedWaters } from '../src/data.js'
import { calcDistanceNM, calcRouteDistanceNM, KEEL_CLEARANCE_FT } from '../src/utils.js'
import { decodeDepthGrid } from '../src/depthGrid.js'
import { planRoute, requiredStep, REACH } from '../src/router.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const GRID_FILE = path.join(here, '..', 'public', 'depth-grid.bin')
const loadGrid = () => decodeDepthGrid(new Uint8Array(zlib.gunzipSync(fs.readFileSync(GRID_FILE))))

// A landmark is stood off, not landed on: routes to one end at its approach,
// as the planner does.
const endOf = (place) => (place.kind === 'landmark' && place.approach ? place.approach : place)
const place = (id) => marinas.find((m) => m.id === id)

// Sample runs worth watching: one inside each region, the harbors whose way out
// is narrow or long, and the runs that cross several regions.
const SAMPLE_PAIRS = [
  ['stamford', 'norwalk'],
  ['norwalk', 'westport'],
  ['stamford', 'port-jefferson'],
  ['new-london', 'mystic'],
  ['mystic', 'watch-hill'],
  ['stony-brook', 'port-jefferson'],
  ['orient-point', 'greenport'],
  ['greenport', 'sag-harbor'],
  ['stamford', 'coecles-harbor'],
  ['montauk', 'block-island-new'],
  ['block-island-new', 'newport'],
  ['newport', 'east-greenwich'],
  ['bristol', 'new-bedford'],
  ['newport', 'cuttyhunk'],
  ['cuttyhunk', 'menemsha'],
  ['new-bedford', 'marion'],
  ['marion', 'hyannis'],
  ['woods-hole', 'edgartown'],
  ['hyannis', 'nantucket'],
  ['stamford', 'nantucket'],
  ['city-island', 'block-island-new'],
]

const RATIO_WARN = 2.5
const SLOW_MS = 1000

// A leg the router ran exactly through the corner of a dry cell comes back
// from latitude and longitude a hair to one side, and clips the cell by a
// millionth of a mile. Anything under a metre is that, not a course over it.
const GRAZE_NM = 0.0005

// The same for a leg run exactly along the edge between two rows of cells, as
// one between the centres of two blocks is: back from latitude and longitude it
// sits a hair to one side, and is walked down the row the router didn't judge
// it by, the whole length of the edge. A waypoint within a few centimetres of a
// cell edge is put back on it.
const onEdge = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : v)

const argv = process.argv.slice(2)
const draftFlag = argv.indexOf('--draft')
const DRAFT_FT = draftFlag === -1 ? 3 : Number(argv[draftFlag + 1])
const args = draftFlag === -1 ? argv : [...argv.slice(0, draftFlag), ...argv.slice(draftFlag + 2)]
if (!(DRAFT_FT >= 0)) {
  console.error('--draft takes a draft in feet, e.g. --draft 6')
  process.exit(2)
}
const MIN_DEPTH_FT = DRAFT_FT + KEEL_CLEARANCE_FT

/**
 * Plan one route and check it. Everything is measured again here from the
 * grid, cell by cell, rather than read back from what the router reports.
 */
function probeRoute(grid, startId, destId) {
  const start = place(startId)
  const dest = place(destId)
  const t0 = performance.now()
  const route = planRoute(grid, endOf(start), endOf(dest), { minDepthFt: MIN_DEPTH_FT, closed: closedWaters })
  const ms = performance.now() - t0
  const direct = calcDistanceNM(start.lat, start.lng, dest.lat, dest.lng)
  if (!route) return { startId, destId, ms, direct, failed: true, problems: [] }

  const need = requiredStep(grid.stepsFt, MIN_DEPTH_FT)
  const farthest = REACH.at(-1)
  const ends = [endOf(start), endOf(dest)].map((p) => grid.cellOf(p.lat, p.lng))
  const nearestEndNM = (y, x) => Math.min(...ends.map((e) => grid.distanceNM(y, x, e.y, e.x)))
  const shut = closedWaters.map((box) => {
    const nw = grid.cellOf(box.north, box.west)
    const se = grid.cellOf(box.south, box.east)
    return { ...box, r0: nw.y, c0: nw.x, r1: se.y, c1: se.x }
  })
  const problems = []
  const pts = route.waypoints.map(([lat, lng]) => {
    const { y, x } = grid.cellOf(lat, lng)
    return { y: onEdge(y), x: onEdge(x) }
  })
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]
    const q = pts[i + 1]
    const legNM = grid.distanceNM(p.y, p.x, q.y, q.x)
    let s = 0
    grid.walk(p.y, p.x, q.y, q.x, (id, value, lengthNM, squeeze) => {
      const t = legNM > 0 ? (s + lengthNM / 2) / legNM : 0
      const y = p.y + (q.y - p.y) * t
      const x = p.x + (q.x - p.x) * t
      s += lengthNM
      const at = grid.latLngOf(y, x)
      const where = `leg ${i + 1} at ${at.lat.toFixed(4)},${at.lng.toFixed(4)}`
      for (const box of shut) {
        if (y > box.r0 && y < box.r1 && x > box.c0 && x < box.c1 && lengthNM > GRAZE_NM) problems.push(`${where} crosses ${box.name}`)
      }
      if (squeeze >= 0 && squeeze < 1 && value < need) problems.push(`${where} slips between two dry cells`)
      if (value >= need || lengthNM <= GRAZE_NM) return
      const near = nearestEndNM(y, x)
      if (value >= 1 && near > farthest.shallowNM + 0.1) problems.push(`${where}: ${lengthNM.toFixed(2)} NM under ${MIN_DEPTH_FT} ft, ${near.toFixed(1)} NM from either end`)
      if (value < 1 && near > farthest.dryNM + 0.1) problems.push(`${where}: ${lengthNM.toFixed(2)} NM over dry cells, ${near.toFixed(1)} NM from either end`)
    })
  }
  const byEnd = (end, kind) => route.stretches
    .filter((st) => st.end === end && st.kind === kind)
    .reduce((sum, st) => sum + st.lengthNM, 0)
  return {
    startId, destId, ms, direct,
    distance: calcRouteDistanceNM(route.waypoints),
    waypoints: route.waypoints,
    heldToFt: route.heldToFt,
    ends: ['start', 'dest'].map((end) => ({ shallow: byEnd(end, 'shallow'), dry: byEnd(end, 'dry') })),
    problems,
  }
}

// --all spreads the pairs over worker threads, each with its own grid.
if (!isMainThread) {
  const grid = loadGrid()
  for (const [a, b] of workerData.pairs) parentPort.postMessage(probeRoute(grid, a, b))
  parentPort.close()
} else {
  main()
}

function main() {
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

  const grid = loadGrid()
  const { header } = grid

  // ── 1. the grid ──────────────────────────────────────────────────────────
  console.log('\nDepth grid')
  console.log(`  ${header.source}`)
  console.log(`  ${header.tiles} survey tiles (${header.scheme}), built ${header.built}`)
  console.log(`  ${header.rows} x ${header.cols} cells of ${(header.dLat * 60 * 1852).toFixed(0)} m, ` +
    `${(fs.statSync(GRID_FILE).size / 1024).toFixed(0)} KB, steps ${header.stepsFt.join(' ')} ft`)

  // ── 2. places ────────────────────────────────────────────────────────────
  // A harbor on a dry cell is let off by the router's dry allowance, but that
  // takes it to the nearest water, which is the wrong water often enough to
  // check: Cuttyhunk's position was on the island's south shore, not the pond.
  console.log('\nPlaces')
  const before = problems + warnings
  for (const p of marinas) {
    if (p.kind !== 'landmark' && grid.valueAt(p.lat, p.lng) < 1) {
      warn(`${p.id} is on a cell the survey has as dry (${p.lat}, ${p.lng})`)
    }
    if (p.approach && grid.valueAt(p.approach.lat, p.approach.lng) < 1) {
      ;(p.kind === 'landmark' ? fail : warn)(`the approach to ${p.id} is on a cell the survey has as dry`)
    }
  }
  if (problems + warnings === before) console.log('  every position and approach is on the water')

  // ── 3. closed waters ─────────────────────────────────────────────────────
  console.log('\nClosed waters')
  for (const box of closedWaters) {
    const nw = grid.cellOf(box.north, box.west)
    const se = grid.cellOf(box.south, box.east)
    let wet = 0
    for (let r = Math.floor(nw.y); r < Math.ceil(se.y); r++) {
      for (let c = Math.floor(nw.x); c < Math.ceil(se.x); c++) if (grid.valueAtCell(r, c) >= 1) wet += 1
    }
    if (wet === 0) fail(`${box.id} sits on no water, so it closes nothing`)
    else console.log(`  ${box.id}: ${wet} water cells closed`)
  }

  // ── 4. routes ────────────────────────────────────────────────────────────
  const describe = (r) => {
    const flag = r.distance / r.direct > RATIO_WARN ? '  <-- long way round?' : ''
    const ends = r.ends.map((e, i) => {
      const bits = []
      if (e.shallow >= 0.05) bits.push(`${e.shallow.toFixed(2)} NM shallow`)
      if (e.dry >= 0.05) bits.push(`${e.dry.toFixed(2)} NM dry`)
      return bits.length ? `${i === 0 ? 'leaving' : 'arriving'}: ${bits.join(', ')}` : null
    }).filter(Boolean)
    return `${r.startId} -> ${r.destId}: ${r.distance.toFixed(1)} NM (direct ${r.direct.toFixed(1)}, ` +
      `x${(r.distance / r.direct).toFixed(2)}), ${r.waypoints.length} waypoints, ${Math.round(r.ms)} ms${flag}` +
      (ends.length ? `\n      ${ends.join('; ')}` : '')
  }
  const judge = (r) => {
    if (r.failed) fail(`${r.startId} -> ${r.destId}: no route found`)
    for (const line of r.problems) fail(`${r.startId} -> ${r.destId}: ${line}`)
    if (r.ms > SLOW_MS) warn(`${r.startId} -> ${r.destId} took ${Math.round(r.ms)} ms to plan`)
  }

  const finish = () => {
    console.log(problems === 0
      ? `\nRoutes are sound. ${warnings} warning(s).\n`
      : `\n${problems} problem(s), ${warnings} warning(s).\n`)
    if (problems > 0) process.exitCode = 1
  }

  console.log(`\nRoutes for a ${DRAFT_FT} ft draft, held to ${MIN_DEPTH_FT} ft`)
  if (args.length === 2 && !args[0].startsWith('--')) {
    if (!place(args[0]) || !place(args[1])) {
      fail(`unknown place: ${!place(args[0]) ? args[0] : args[1]}`)
      return finish()
    }
    const r = probeRoute(grid, args[0], args[1])
    if (!r.failed) {
      console.log(`  ${describe(r)}`)
      for (let i = 0; i + 1 < r.waypoints.length; i++) {
        const [aLat, aLng] = r.waypoints[i]
        const [bLat, bLng] = r.waypoints[i + 1]
        console.log(`      leg ${String(i + 1).padStart(2)}: ${aLat.toFixed(4)},${aLng.toFixed(4)} -> ` +
          `${bLat.toFixed(4)},${bLng.toFixed(4)}  ${calcDistanceNM(aLat, aLng, bLat, bLng).toFixed(2)} NM`)
      }
    }
    judge(r)
    return finish()
  }

  if (args[0] !== '--all') {
    for (const [a, b] of SAMPLE_PAIRS) {
      const r = probeRoute(grid, a, b)
      if (!r.failed) console.log(`  ${describe(r)}`)
      judge(r)
    }
    return finish()
  }

  // Every unordered pair. The router treats A->B and B->A alike but for which
  // way round a tie falls, so one of each is enough to find what is broken.
  const pairs = []
  for (let i = 0; i < marinas.length; i++) {
    for (let j = i + 1; j < marinas.length; j++) pairs.push([marinas[i].id, marinas[j].id])
  }
  const threads = Math.max(1, Math.min(os.cpus().length, 8))
  console.log(`  ${pairs.length} routes on ${threads} threads`)
  const results = []
  let running = threads
  for (let t = 0; t < threads; t++) {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { pairs: pairs.filter((_, k) => k % threads === t) },
      argv: process.argv.slice(2),
    })
    worker.on('message', (r) => {
      results.push(r)
      if (results.length % 250 === 0) console.log(`  ... ${results.length}`)
    })
    worker.on('error', (error) => {
      fail(`worker failed: ${error.message}`)
    })
    worker.on('exit', () => {
      running -= 1
      if (running > 0) return
      for (const r of results) judge(r)
      const times = results.map((r) => r.ms).sort((x, y) => x - y)
      const pct = (q) => Math.round(times[Math.min(times.length - 1, Math.floor(q * times.length))])
      console.log(`  planning time: median ${pct(0.5)} ms, 90% ${pct(0.9)} ms, 99% ${pct(0.99)} ms, slowest ${pct(1)} ms`)
      const long = results.filter((r) => !r.failed && r.distance / r.direct > RATIO_WARN)
      if (long.length) {
        console.log(`  ${long.length} routes over ${RATIO_WARN}x the straight line (worth a look on the chart):`)
        for (const r of long.sort((x, y) => y.distance / y.direct - x.distance / x.direct).slice(0, 12)) console.log(`    ${describe(r)}`)
      }
      finish()
    })
  }
}
