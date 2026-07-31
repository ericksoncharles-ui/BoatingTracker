// Finds a course that stays in the water.
//
// The old router walked a hand-placed channel graph and rejected a chord only
// when it crossed one of a dozen keep-out circles. Those circles covered Eatons
// Neck, Lloyd Neck and the Elizabeth Islands — nothing along the Connecticut
// shore, where most trips actually happen — so three quarters of all place
// pairs came back with a course drawn over land. This replaces the guesswork
// with a search over the real coastline.
//
// The search grid is the coastline bitmap downsampled 2x. It decides only what
// the search may consider; the fine mask decides what a boat may do, and every
// step and every shortcut is cleared against it.
//
// A shortest path is not a course. Left to itself it shaves every headland it
// rounds, so the search pays to stand off the beach and a shortcut is taken at
// the most generous offing that still allows one. That approximates staying
// mid-channel; it is not the same as following the marked channel, which would
// need buoy positions this app does not carry.

import { LAND_MASK } from '../landMask.generated.js'
import { segmentHitsLand } from './landMask.js'

const { west, east, south, north, cols: fineCols, rows: fineRows } = LAND_MASK

const FACTOR = 2
const COLS = Math.floor(fineCols / FACTOR)
const ROWS = Math.floor(fineRows / FACTOR)

const dLng = (east - west) / COLS
const dLat = (north - south) / ROWS

// Metres per cell, at the middle of the covered latitudes. The region spans
// 1.6 degrees, so the cosine term moves by under 2% across it — not worth
// carrying a per-row scale for.
const MID_LAT = (south + north) / 2
const CELL_W_M = dLng * 111320 * Math.cos((MID_LAT * Math.PI) / 180)
const CELL_H_M = dLat * 110570
const M_PER_NM = 1852

// How far off the beach a course prefers to stand, and how much it will pay to
// do it. Without this the shortest path around any point grazes it — correct
// geometry, poor seamanship. Eight cells is a little under a mile.
const STANDOFF_CELLS = 10
const STANDOFF_MAX_MULTIPLIER = 2.4

// A coarse cell is searchable when any of its fine cells is water.
//
// The strict rule — all four fine cells water — buys clearance but seals any
// channel narrower than about 360 m, which turned upper Narragansett Bay into
// an isolated pond: every route to East Greenwich failed the search and fell
// back to the old channel graph, the very thing that draws courses over land.
//
// Being this permissive is only safe because a step between two cells is not
// allowed unless the course between their centres is clear on the fine mask
// (see the neighbour loop in findWaterPath). The grid decides what the search
// may consider; the fine mask decides what a boat may do.
const MAX_LAND_SUBCELLS = FACTOR * FACTOR - 1

let grid = null

function buildGrid() {
  if (grid) return grid

  const binary = atob(LAND_MASK.bits)
  const fine = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) fine[i] = binary.charCodeAt(i)
  const fineAt = (r, c) => {
    const i = r * fineCols + c
    return (fine[i >> 3] >> (i & 7)) & 1
  }

  // 1 = the search may pass through, 0 = solid land.
  const water = new Uint8Array(COLS * ROWS)
  // Cells with no land in them at all. Clearance is measured against these,
  // not against `water` — a cell counted as passable may still be three
  // quarters beach, and measuring distance from those makes the route think it
  // has room where it has none.
  const clear = new Uint8Array(COLS * ROWS)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let landCount = 0
      for (let dr = 0; dr < FACTOR; dr++) {
        for (let dc = 0; dc < FACTOR; dc++) {
          landCount += fineAt(r * FACTOR + dr, c * FACTOR + dc)
        }
      }
      water[r * COLS + c] = landCount <= MAX_LAND_SUBCELLS && landCount < FACTOR * FACTOR ? 1 : 0
      clear[r * COLS + c] = landCount === 0 ? 1 : 0
    }
  }

  // Chamfer distance to the nearest cell holding any land, in cells, capped —
  // only the first few cells matter, and capping keeps this in a Uint8Array.
  const CAP = STANDOFF_CELLS + 1
  const dist = new Uint8Array(COLS * ROWS)
  for (let i = 0; i < clear.length; i++) dist[i] = clear[i] ? CAP : 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      if (!dist[i]) continue
      let best = dist[i]
      if (r > 0) best = Math.min(best, dist[i - COLS] + 1)
      if (c > 0) best = Math.min(best, dist[i - 1] + 1)
      if (r > 0 && c > 0) best = Math.min(best, dist[i - COLS - 1] + 1)
      if (r > 0 && c < COLS - 1) best = Math.min(best, dist[i - COLS + 1] + 1)
      dist[i] = best
    }
  }
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = COLS - 1; c >= 0; c--) {
      const i = r * COLS + c
      if (!dist[i]) continue
      let best = dist[i]
      if (r < ROWS - 1) best = Math.min(best, dist[i + COLS] + 1)
      if (c < COLS - 1) best = Math.min(best, dist[i + 1] + 1)
      if (r < ROWS - 1 && c < COLS - 1) best = Math.min(best, dist[i + COLS + 1] + 1)
      if (r < ROWS - 1 && c > 0) best = Math.min(best, dist[i + COLS - 1] + 1)
      dist[i] = best
    }
  }

  grid = { water, dist, cols: COLS, rows: ROWS }
  return grid
}

const colF = (lng) => (lng - west) / dLng
const rowF = (lat) => (lat - south) / dLat
const colOf = (lng) => Math.floor(colF(lng))
const rowOf = (lat) => Math.floor(rowF(lat))
const lngOf = (c) => west + (c + 0.5) * dLng
const latOf = (r) => south + (r + 0.5) * dLat

function inGrid(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

// Cost multiplier for standing this far off the beach.
function standoffMultiplier(d) {
  if (d >= STANDOFF_CELLS) return 1
  const closeness = (STANDOFF_CELLS - d) / STANDOFF_CELLS
  return 1 + (STANDOFF_MAX_MULTIPLIER - 1) * closeness * closeness
}

// How much water a cell needs around it to be worth starting from.
//
// The nearest water cell to a harbor is often a sliver against the shore that
// the step check cannot get out of — East Greenwich snapped into one and the
// search then exhausted Narragansett Bay without ever reaching it. Preferring a
// cell with room around it puts the search in the channel, not in the corner.
const SNAP_CLEARANCE_CELLS = 2

// Nearest navigable cell to a point, searched in rings. Harbor coordinates and
// some approach waypoints sit on cells the grid calls land — a marina is behind
// a breakwater, and a breakwater is land at this resolution — so the search has
// to start from the open water outside them.
function snapToWater(lat, lng, blocked, maxRings = 40) {
  const { water, dist } = buildGrid()
  const r0 = rowOf(lat)
  const c0 = colOf(lng)
  const free = (r, c) => inGrid(r, c) && water[r * COLS + c] === 1 && !(blocked && blocked[r * COLS + c])
  const roomy = (r, c) => free(r, c) && dist[r * COLS + c] >= SNAP_CLEARANCE_CELLS

  for (const test of [roomy, free]) {
    if (test(r0, c0)) return { r: r0, c: c0 }
    for (let ring = 1; ring <= maxRings; ring++) {
      let best = null
      let bestD = Infinity
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue
          const r = r0 + dr
          const c = c0 + dc
          if (!test(r, c)) continue
          const d = dr * dr + dc * dc
          if (d < bestD) { bestD = d; best = { r, c } }
        }
      }
      if (best) return best
    }
  }
  return null
}

// Cells a boat of this draft must keep out of, over and above land: the shoals
// whose charted depth it cannot clear, and any passage the app deliberately
// does not model.
function blockedCells(hazards) {
  if (!hazards || hazards.length === 0) return null
  const blocked = new Uint8Array(COLS * ROWS)
  for (const h of hazards) {
    const radiusRows = Math.ceil((h.radiusNM * M_PER_NM) / CELL_H_M)
    const radiusCols = Math.ceil((h.radiusNM * M_PER_NM) / CELL_W_M)
    const r0 = rowOf(h.lat)
    const c0 = colOf(h.lng)
    for (let dr = -radiusRows; dr <= radiusRows; dr++) {
      for (let dc = -radiusCols; dc <= radiusCols; dc++) {
        const r = r0 + dr
        const c = c0 + dc
        if (!inGrid(r, c)) continue
        const dy = (dr * CELL_H_M) / M_PER_NM
        const dx = (dc * CELL_W_M) / M_PER_NM
        if (Math.hypot(dx, dy) <= h.radiusNM) blocked[r * COLS + c] = 1
      }
    }
  }
  return blocked
}

// Binary heap keyed on f-score.
function makeHeap() {
  const idx = []
  const key = []
  const push = (i, f) => {
    idx.push(i); key.push(f)
    let n = idx.length - 1
    while (n > 0) {
      const p = (n - 1) >> 1
      if (key[p] <= key[n]) break
      ;[idx[p], idx[n]] = [idx[n], idx[p]]
      ;[key[p], key[n]] = [key[n], key[p]]
      n = p
    }
  }
  const pop = () => {
    const top = idx[0]
    const lastI = idx.pop()
    const lastK = key.pop()
    if (idx.length > 0) {
      idx[0] = lastI; key[0] = lastK
      let n = 0
      for (;;) {
        const l = 2 * n + 1
        const r = l + 1
        let m = n
        if (l < idx.length && key[l] < key[m]) m = l
        if (r < idx.length && key[r] < key[m]) m = r
        if (m === n) break
        ;[idx[m], idx[n]] = [idx[n], idx[m]]
        ;[key[m], key[n]] = [key[n], key[m]]
        n = m
      }
    }
    return top
  }
  return { push, pop, get size() { return idx.length } }
}

const NEIGHBORS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
]

// Closest approach of a hazard circle to a course, in NM. Mirrors the
// point-to-segment test in utils.js; kept local so this module stays free of
// imports that would make the two circular.
function hazardBlocksCourse(from, to, hazards) {
  if (!hazards || hazards.length === 0) return false
  const cosLat = Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180)
  const ax = from.lng * 60 * cosLat
  const ay = from.lat * 60
  const bx = to.lng * 60 * cosLat
  const by = to.lat * 60
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  for (const h of hazards) {
    const px = h.lng * 60 * cosLat
    const py = h.lat * 60
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const nearest = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    // The ends are exempt: a harbor whose approach lies inside a shoal circle
    // still has to be reachable, and the first and last stretch of a course are
    // curated harbor water either way.
    if (t > 0.02 && t < 0.98 && nearest < h.radiusNM) return true
  }
  return false
}

/**
 * True when a boat can steer straight from a to b without touching land or a
 * hazard it cannot clear.
 *
 * Land is judged by the fine coastline mask — the same function the audit uses
 * — not by the search grid. The search grid is deliberately permissive so that
 * narrow channels stay connected, so it is not fit to clear a course, and an
 * earlier version that trusted it for both jobs reported clear water across
 * Eatons Neck and Stratford Point.
 */
export function directCourseIsClear(from, to, hazards) {
  if (segmentHitsLand(from.lat, from.lng, to.lat, to.lng, 0)) return false
  return !hazardBlocksCourse(from, to, hazards)
}

// Shore clearance a shortcut has to keep, in search cells (~180 m each), tried
// in order — roughly 0.5, 0.3, 0.2 and 0.1 NM, then anything that is water.
//
// Straightening a path on a plain land check produces a course that shaves
// every headland it rounds: measured against the mask, routes came out with
// 300 feet of clearance and less. That is water, but it is not water anyone
// steers through. The marked channel is further off, and a skipper following
// the plotted line would be outside the buoys and among the rocks.
//
// A shortcut is therefore taken at the most generous offing that still allows
// one, falling back to a thinner margin only where the water genuinely is thin.
export const SHORTCUT_CLEARANCES = [5, 3, 2, 1, 0]

/**
 * Least clearance the straight course from a to b keeps, in search cells.
 *
 * Read off the precomputed distance-to-land field rather than by testing a
 * padded box at every step: the box is (2p+1)^2 lookups per step and turned a
 * long route into seconds of work, while this is one lookup per cell crossed.
 */
export function courseClearance(from, to) {
  const { dist } = buildGrid()
  const steps = Math.max(
    2,
    Math.ceil(Math.max(
      Math.abs(rowF(to.lat) - rowF(from.lat)),
      Math.abs(colF(to.lng) - colF(from.lng)),
    )),
  )
  let worst = Infinity
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const r = rowOf(from.lat + (to.lat - from.lat) * t)
    const c = colOf(from.lng + (to.lng - from.lng) * t)
    if (!inGrid(r, c)) return 0
    const d = dist[r * COLS + c]
    if (d < worst) worst = d
    if (worst === 0) return 0
  }
  return worst
}

/**
 * Furthest point in `points` reachable from `points[i]` in a straight line,
 * preferring a course that keeps water under the boat over the longest chord
 * that merely misses the beach.
 */
export function furthestClearTarget(points, i, hazards) {
  for (const wanted of SHORTCUT_CLEARANCES) {
    for (let j = points.length - 1; j > i + 1; j--) {
      if (courseClearance(points[i], points[j]) < wanted) continue
      if (directCourseIsClear(points[i], points[j], hazards)) return j
    }
  }
  return i + 1
}

/**
 * Shortest navigable path between two positions, as [lat, lng] pairs.
 *
 * Returns null when there is no water route between them — which for this app
 * means one of the endpoints is somewhere the coastline data says is dry, not
 * that the boat cannot get there.
 */
export function findWaterPath(from, to, hazards) {
  const { water, dist } = buildGrid()
  const blocked = blockedCells(hazards)

  // A hazard circle sitting on top of a harbor approach would make it
  // unreachable; the boat has to be allowed out of where it already is.
  const startCell = snapToWater(from.lat, from.lng, blocked) || snapToWater(from.lat, from.lng, null)
  const goalCell = snapToWater(to.lat, to.lng, blocked) || snapToWater(to.lat, to.lng, null)
  if (!startCell || !goalCell) return null

  const startIdx = startCell.r * COLS + startCell.c
  const goalIdx = goalCell.r * COLS + goalCell.c
  if (startIdx === goalIdx) return [[latOf(startCell.r), lngOf(startCell.c)]]

  const n = COLS * ROWS
  const g = new Float32Array(n).fill(Infinity)
  const cameFrom = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)

  const heuristic = (r, c) => {
    const dy = (r - goalCell.r) * CELL_H_M
    const dx = (c - goalCell.c) * CELL_W_M
    return Math.hypot(dx, dy)
  }

  const heap = makeHeap()
  g[startIdx] = 0
  heap.push(startIdx, heuristic(startCell.r, startCell.c))

  // If the goal turns out to be walled off — a harbor the mask draws as closed
  // — the search still knows the nearest water it *could* reach. Ending there
  // and letting the last stretch into the harbor be curated data beats failing
  // to the channel graph, which answers with a course over land.
  let bestIdx = startIdx
  let bestH = heuristic(startCell.r, startCell.c)

  let found = false
  while (heap.size > 0) {
    const current = heap.pop()
    if (closed[current]) continue
    closed[current] = 1
    if (current === goalIdx) { found = true; break }

    const cr = (current / COLS) | 0
    const cc = current - cr * COLS
    const h = heuristic(cr, cc)
    if (h < bestH) { bestH = h; bestIdx = current }

    for (const [dr, dc] of NEIGHBORS) {
      const nr = cr + dr
      const nc = cc + dc
      if (!inGrid(nr, nc)) continue
      const ni = nr * COLS + nc
      if (closed[ni]) continue
      if (water[ni] !== 1) continue
      // The goal keeps its exemption from hazard blocking, so a boat can reach
      // a harbor whose approach lies inside a shoal circle it cannot clear.
      if (blocked && blocked[ni] && ni !== goalIdx) continue

      // The step itself has to be navigable, not just the cell it lands in.
      // This is what lets the grid above stay permissive enough to keep narrow
      // channels connected without ever handing back a path that crosses land:
      // every edge the search can take is one the fine coastline allows, so the
      // whole path is clear by construction rather than by later inspection.
      // The two endpoints are exempt — they may have been snapped out of a
      // harbor the mask draws as solid.
      if (current !== startIdx && ni !== goalIdx &&
          segmentHitsLand(latOf(cr), lngOf(cc), latOf(nr), lngOf(nc), 0)) continue

      const stepM = Math.hypot(dc * CELL_W_M, dr * CELL_H_M)
      const tentative = g[current] + stepM * standoffMultiplier(dist[ni])
      if (tentative < g[ni]) {
        g[ni] = tentative
        cameFrom[ni] = current
        heap.push(ni, tentative + heuristic(nr, nc))
      }
    }
  }

  const endIdx = found ? goalIdx : bestIdx
  if (endIdx === startIdx) return null

  const cells = []
  for (let i = endIdx; i !== -1; i = cameFrom[i]) {
    const r = (i / COLS) | 0
    cells.push([r, i - r * COLS])
    if (i === startIdx) break
  }
  cells.reverse()

  // Greedy line-of-sight pass: from each kept point, jump to the furthest point
  // still reachable in a straight navigable line. An A* path on an 8-connected
  // grid is a staircase; this turns it back into the handful of courses a
  // skipper would actually steer.
  const pos = cells.map(([r, c]) => ({ lat: latOf(r), lng: lngOf(c) }))
  const simplified = [pos[0]]
  let i = 0
  while (i < pos.length - 1) {
    const next = furthestClearTarget(pos, i, hazards)
    simplified.push(pos[next])
    i = next
  }

  return simplified.map((p) => [p.lat, p.lng])
}

export const WATER_GRID_META = { cols: COLS, rows: ROWS, cellWidthM: CELL_W_M, cellHeightM: CELL_H_M }
