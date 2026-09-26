// The router: the shortest way between two places that keeps to water charted
// at least as deep as the boat needs, found on the depth grid (depthGrid.js)
// rather than along any course somebody drew.
//
// Water is priced by the mile:
//
//   - deep enough for the boat: a mile is a mile;
//   - too shallow for it, but water: fifty-one miles a mile where it is a foot
//     short, and twenty-five more for every foot shorter than that, and only
//     within a few miles of either end of the route;
//   - dry at low water, or not surveyed: five hundred miles a mile, or twice
//     the shallowest water's price if that is more, and only in the last few
//     hundred yards to either dock;
//   - closed (see closedWaters in data.js), or anything else: not at all.
//
// The shallow and dry allowances are for harbors. A marina is often in water
// shallower than the boat wants under it: that is what the harbor's
// controlling depth is for, and it is the tide, not the route, that answers
// it. A dock position can sit on the quay, and a dredged cut can be narrower
// than a cell. The prices make the route take the least of either there is a
// way to take, and the deepest of it: up the channel, not across the flats
// beside it, which at one price for all shallow water were as good as the
// channel and often shorter. Out in the Sound a shoal is never "worth it" to
// save a few miles: it is simply not water the route can use.
//
// The search is Lazy Theta* over the grid's leaves (the squares of one depth
// depthGrid.js describes): A* whose steps may run in any direction, so a
// course across open water is one straight line rather than a staircase of
// cell centres. It is guided by a rough pass over blocks (about 150 m) from the
// destination back, which knows what lies in the way. Then the path is pulled
// tight wherever a straight line costs no more than the stretch it replaces,
// and the stretches off deep water are measured for the sidebar.

const DEEP = 0
const SHALLOW = 1
const DRY = 2

const DEEP_COST = 1
const SHALLOW_COST = 25
const SHALLOW_COST_PER_FT = 25
const DRY_COST = 500

// How far from its end a route may be in water too shallow for the boat, and
// how far it may cross cells the survey has as dry. Mystic Seaport is two and
// a half miles up its river; a dock position can be a hundred yards up the
// quay. An end with no way out at these climbs to the next rung: first a
// harbor whose dredged cut is narrower than a cell, and so reads as dry all
// the way across, like the one into Coecles Harbor (the price of dry cells
// makes the search take the least of them there is, which is the cut); then
// one up a long shallow creek.
export const REACH = [
  { shallowNM: 3, dryNM: 0.25 },
  { shallowNM: 3, dryNM: 1.2 },
  { shallowNM: 6, dryNM: 1.2 },
]

// How much the search leans toward the destination, over what it has come.
// With an exact estimate the search must still look at every leaf that might
// be on a route as short, and a run that has to bend round Orient Point has
// every shore in that ellipse. Leaning ten percent costs a route a few tenths
// of a mile at most, and usually nothing once it is pulled tight.
const WEIGHT = 1.1

// Passed for the two cells beside a corner when a neighbour shares an edge.
const EDGE = -2

// Pulling the path tight tries a straight line past this many points that
// don't work before settling for the furthest that did.
const PULL_PATIENCE = 12

/**
 * The index a cell's depth step must reach for a boat needing `minDepthFt`:
 * the first step at least that deep. A boat needing 9 ft is held to the 10 ft
 * step, never allowed the 8.
 */
export function requiredStep(stepsFt, minDepthFt) {
  const i = stepsFt.findIndex((ft) => ft >= minDepthFt)
  if (i === -1) throw new RangeError(`The chart data does not distinguish depths past ${stepsFt.at(-1)} ft`)
  return i + 1
}

/**
 * Plan a route from `from` to `to` ({ lat, lng } each) that keeps to water at
 * least `minDepthFt` deep at MLLW everywhere but near its ends, and out of
 * every box in `closed` ({ south, west, north, east }) whatever its depth.
 * Returns null when the grid has no water route between them at all.
 */
export function planRoute(grid, from, to, { minDepthFt, closed = [] }) {
  const need = requiredStep(grid.stepsFt, minDepthFt)
  // The wider allowances go only to an end whose water turned out to be
  // closed off: Stamford's shoals have no business being open to a route
  // because Coecles Harbor, at the other end, is up a cut the grid can't see.
  let rungA = 0
  let rungB = 0
  for (;;) {
    const settings = { need, reachA: REACH[rungA], reachB: REACH[rungB], closed }
    const model = costModel(grid, from, to, settings)
    if (!model) return null
    const found = search(model, costModel(grid, from, to, { ...settings, rough: true }))
    if (found.points) return describe(model, pullTight(model, found.points))
    const climbA = found.closedOffA && rungA < REACH.length - 1
    const climbB = found.closedOffB && rungB < REACH.length - 1
    if (!climbA && !climbB) return null
    if (climbA) rungA += 1
    if (climbB) rungB += 1
  }
}

// The prices above, for one route: which leaves are water the route may use
// and at what cost, and what a straight line between two points costs. A
// rough model sees blocks (see depthGrid.roughViewFor): it is only ever asked
// which way to go.
function costModel(grid, from, to, { need, reachA, reachB, closed, rough = false }) {
  const { leafRect, nmPerRow, nmPerCol, superCols } = grid
  const a = grid.cellOf(from.lat, from.lng)
  const b = grid.cellOf(to.lat, to.lng)
  const dist = (y0, x0, y1, x1) => {
    const dy = (y1 - y0) * nmPerRow
    const dx = (x1 - x0) * nmPerCol
    return Math.sqrt(dy * dy + dx * dx)
  }
  const classOfValue = (v) => (v >= need ? DEEP : v >= 1 ? SHALLOW : DRY)

  // Closed water as boxes of cells, and the super-blocks they touch, so an
  // open super-block costs one lookup to clear.
  const shut = closed.map((box) => {
    const nw = grid.cellOf(box.north, box.west)
    const se = grid.cellOf(box.south, box.east)
    return [Math.floor(nw.y), Math.floor(nw.x), Math.ceil(se.y), Math.ceil(se.x)]
  })
  const shutSupers = new Set()
  for (const [r0, c0, r1, c1] of shut) {
    for (let r = r0 >> 6; r <= (r1 - 1) >> 6; r++) {
      for (let c = c0 >> 6; c <= (c1 - 1) >> 6; c++) shutSupers.add(r * superCols + c)
    }
  }
  const isShut = (r0, c0, size) =>
    shutSupers.has((r0 >> 6) * superCols + (c0 >> 6)) &&
    shut.some(([sr0, sc0, sr1, sc1]) => r0 < sr1 && r0 + size > sr0 && c0 < sc1 && c0 + size > sc0)

  // Nearest distance from a point to a square.
  const toSquare = (r0, c0, size, p) => {
    const dy = Math.max(r0 - p.y, 0, p.y - (r0 + size))
    const dx = Math.max(c0 - p.x, 0, p.x - (c0 + size))
    return dist(0, 0, dy, dx)
  }
  // Whether water of a class may be used in a square, by how near it is to
  // an end that allows it.
  const allowed = (r0, c0, size, cls) => {
    const key = cls === SHALLOW ? 'shallowNM' : 'dryNM'
    return toSquare(r0, c0, size, a) <= reachA[key] || toSquare(r0, c0, size, b) <= reachB[key]
  }
  // A square with no cell deep enough is no use to the route at all when it
  // is further from both ends than its water is allowed to be.
  const view = rough
    ? grid.roughViewFor(need)
    : grid.viewFor(need, (r0, c0, size, deepest) => !allowed(r0, c0, size, deepest >= 1 ? SHALLOW : DRY))
  const { leafAt, leafValue } = view

  const leafA = leafAt(Math.floor(a.y), Math.floor(a.x))
  const leafB = leafAt(Math.floor(b.y), Math.floor(b.x))
  if (leafA < 0 || leafB < 0) return null
  const sq = new Int32Array(3)
  const harborBlocks = new Set([leafA, leafB])

  // A mile's price at each depth step, for this boat: see the top of the file.
  // A step's depth is the least it could be, so a foot short is a foot short.
  const { stepsFt } = grid
  const mileCost = new Float64Array(stepsFt.length + 1)
  for (let v = 1; v <= stepsFt.length; v++) {
    const shortFt = stepsFt[need - 1] - stepsFt[v - 1]
    mileCost[v] = v >= need ? DEEP_COST : DEEP_COST + SHALLOW_COST + SHALLOW_COST_PER_FT * shortFt
  }
  mileCost[0] = Math.max(DRY_COST, 2 * mileCost[1])

  // What a mile in this leaf costs, or 0 where the route may not go.
  const price = (id, value = leafValue(id)) => {
    if (id < 0) return 0
    leafRect(id, sq)
    if (shutSupers.size > 0 && isShut(sq[0], sq[1], sq[2])) return 0
    if (value >= need) return DEEP_COST
    // Near the ends a rough model takes only the blocks the way out of each
    // harbor runs through (see harborToll), at a mile a mile: allowed every
    // block with water in it, it found its way into Greenport through the
    // marsh creeks of the North Fork.
    if (rough) return harborBlocks.has(id) ? DEEP_COST : 0
    return allowed(sq[0], sq[1], sq[2], value >= 1 ? SHALLOW : DRY) ? mileCost[value] : 0
  }

  /**
   * The cost of the straight line from p to q ({ y, x } each), or Infinity if
   * it crosses anything the route may not use, or squeezes past a corner
   * between two cells worse than the water either side of it. Gives up once
   * the cost passes `limit`.
   */
  function lineCost(p, q, limit = Infinity) {
    let cost = 0
    let prevClass = -1
    grid.walk(p.y, p.x, q.y, q.x, (id, value, lengthNM, squeeze) => {
      const cls = classOfValue(value)
      const m = price(id, value)
      if (m === 0 || (squeeze >= 0 && classOfValue(squeeze) > Math.max(cls, prevClass))) {
        cost = Infinity
        return false
      }
      cost += lengthNM * m
      prevClass = cls
      return cost <= limit
    }, view)
    return cost
  }

  return {
    grid, need, reachA, reachB, a, b, leafA, leafB, leafAt, leafValue, view, harborBlocks,
    dist, classOfValue, price, lineCost,
  }
}

// A binary heap of (priority, leaf) pairs on typed arrays: a long route pushes
// tens of thousands of them.
function createHeap() {
  let keys = new Float64Array(1024)
  let items = new Int32Array(1024)
  let size = 0
  const heap = {
    topKey: 0,
    get size() { return size },
    push(key, item) {
      if (size === keys.length) {
        const k = new Float64Array(size * 2)
        k.set(keys)
        keys = k
        const it = new Int32Array(size * 2)
        it.set(items)
        items = it
      }
      let i = size++
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (keys[parent] <= key) break
        keys[i] = keys[parent]
        items[i] = items[parent]
        i = parent
      }
      keys[i] = key
      items[i] = item
    },
    // The item with the lowest key; the key is left in topKey.
    pop() {
      const item = items[0]
      heap.topKey = keys[0]
      const key = keys[--size]
      const last = items[size]
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= size) break
        const r = l + 1
        const m = r < size && keys[r] < keys[l] ? r : l
        if (keys[m] >= key) break
        keys[i] = keys[m]
        items[i] = items[m]
        i = m
      }
      keys[i] = key
      items[i] = last
      return item
    },
  }
  return heap
}

// Search state per leaf, in an open-addressing table on typed arrays: a route
// touches tens of thousands of the grid's five million leaves, and Maps of
// that many entries were most of the planner's time.
const CLOSED = 1
const UNCHECKED = 2
function createLeafTable() {
  let bits = 0
  let mask = 0
  let count = 0
  let keys
  let cost
  let from
  let flags
  const alloc = (b) => {
    bits = b
    mask = (1 << b) - 1
    count = 0
    keys = new Int32Array(1 << b).fill(-1)
    cost = new Float64Array(1 << b)
    from = new Int32Array(1 << b)
    flags = new Uint8Array(1 << b)
  }
  alloc(12)
  const slot = (id) => {
    for (let i = Math.imul(id, 0x9e3779b1) >>> (32 - bits); ; i = (i + 1) & mask) {
      const k = keys[i]
      if (k === id) return i
      if (k === -1) return -1
    }
  }
  const add = (id) => {
    if (2 * (count + 1) > keys.length) {
      const [k0, c0, f0, g0] = [keys, cost, from, flags]
      alloc(bits + 1)
      for (let i = 0; i < k0.length; i++) {
        if (k0[i] === -1) continue
        const j = add(k0[i])
        cost[j] = c0[i]
        from[j] = f0[i]
        flags[j] = g0[i]
      }
    }
    for (let i = Math.imul(id, 0x9e3779b1) >>> (32 - bits); ; i = (i + 1) & mask) {
      const k = keys[i]
      if (k === id) return i
      if (k === -1) {
        keys[i] = id
        cost[i] = Infinity
        from[i] = -1
        flags[i] = 0
        count += 1
        return i
      }
    }
  }
  return {
    cost(id) {
      const i = slot(id)
      return i < 0 ? Infinity : cost[i]
    },
    from(id) {
      const i = slot(id)
      return i < 0 ? -1 : from[i]
    },
    set(id, c, f) {
      const i = add(id)
      cost[i] = c
      from[i] = f
    },
    is(id, flag) {
      const i = slot(id)
      return i >= 0 && (flags[i] & flag) !== 0
    },
    mark(id, flag, on = true) {
      const i = add(id)
      flags[i] = on ? flags[i] | flag : flags[i] & ~flag
    },
  }
}

// The leaves of a model as a graph: where each is, which touch it, and what a
// step between two costs.
function graphOf(model) {
  const { grid, a, b, leafA, leafB, leafAt, leafValue, dist, classOfValue, price } = model
  const { leafRect } = grid
  const rect = new Int32Array(3)

  // Where a leaf is, for measuring: its centre, or the place itself for the
  // leaves the two ends are in.
  const pointOf = (id) => {
    if (id === leafA) return a
    if (id === leafB) return b
    leafRect(id, rect)
    return { y: rect[0] + rect[2] / 2, x: rect[1] + rect[2] / 2 }
  }
  const between = (u, v) => {
    const p = pointOf(u)
    const q = pointOf(v)
    return dist(p.y, p.x, q.y, q.x)
  }

  // Every leaf touching this one along an edge, and those meeting it only at
  // a corner, with the two cells either side of that corner. Leaves are
  // aligned squares whose sizes divide one another, so the line between two
  // leaves' centres stays in those two leaves, and for a corner neighbour runs
  // through the corner itself.
  const own = new Int32Array(3)
  const step = new Int32Array(3)
  function eachNeighbor(id, fn) {
    leafRect(id, own)
    const r0 = own[0]
    const c0 = own[1]
    const r1 = r0 + own[2]
    const c1 = c0 + own[2]
    for (let k = c0; k < c1;) {
      const n = leafAt(r0 - 1, k)
      if (n < 0) { k += 1; continue }
      fn(n, EDGE, EDGE)
      leafRect(n, step)
      k = step[1] + step[2]
    }
    for (let k = c0; k < c1;) {
      const n = leafAt(r1, k)
      if (n < 0) { k += 1; continue }
      fn(n, EDGE, EDGE)
      leafRect(n, step)
      k = step[1] + step[2]
    }
    for (let k = r0; k < r1;) {
      const n = leafAt(k, c0 - 1)
      if (n < 0) { k += 1; continue }
      fn(n, EDGE, EDGE)
      leafRect(n, step)
      k = step[0] + step[2]
    }
    for (let k = r0; k < r1;) {
      const n = leafAt(k, c1)
      if (n < 0) { k += 1; continue }
      fn(n, EDGE, EDGE)
      leafRect(n, step)
      k = step[0] + step[2]
    }
    const corner = (cr, cc, orthoR, orthoC) => {
      const n = leafAt(cr, cc)
      if (n < 0) return
      const o1 = leafAt(cr, orthoC)
      const o2 = leafAt(orthoR, cc)
      if (n !== o1 && n !== o2) fn(n, o1, o2)
    }
    corner(r0 - 1, c0 - 1, r0, c0)
    corner(r0 - 1, c1, r0, c1 - 1)
    corner(r1, c0 - 1, r1 - 1, c0)
    corner(r1, c1, r1 - 1, c1 - 1)
  }

  const classOf = (id) => classOfValue(leafValue(id))
  // The cost of stepping between two neighbouring leaves, centre to centre:
  // half the way in each. A corner step may not squeeze between two cells both
  // worse than the leaves it joins.
  function stepCost(u, v, o1, o2) {
    const pu = price(u)
    const pv = price(v)
    if (pu === 0 || pv === 0) return Infinity
    if (o1 !== EDGE) {
      const worst = Math.max(classOf(u), classOf(v))
      const better = Math.min(o1 < 0 ? DRY : classOf(o1), o2 < 0 ? DRY : classOf(o2))
      if (better > worst) return Infinity
    }
    return between(u, v) * (pu + pv) / 2
  }

  return { pointOf, between, eachNeighbor, stepCost }
}

/**
 * Lazy Theta* from leaf `start` until leaf `goal` is settled: A* whose steps
 * may run straight from a leaf's parent's parent when the line between them is
 * no dearer, so paths across open water are straight. `estimate(id)` is what
 * is left to go (Infinity where there is no way). Returns the search's table,
 * whose `from` pointers lead back from the goal, and whether it got there.
 */
function thetaStar(model, graph, start, goal, estimate) {
  const { price, lineCost } = model
  const { pointOf, between, eachNeighbor, stepCost } = graph
  const table = createLeafTable()
  table.set(start, 0, start)
  const heap = createHeap()
  heap.push(estimate(start), start)

  while (heap.size > 0) {
    const s = heap.pop()
    if (table.is(s, CLOSED)) continue
    let gs = table.cost(s)
    if (heap.topKey > gs + estimate(s) + 1e-9) continue

    // Walk the assumed straight line now. If it crosses anything worse than
    // it was priced at, take the best step from a neighbour already settled.
    if (table.is(s, UNCHECKED)) {
      table.mark(s, UNCHECKED, false)
      const p = table.from(s)
      const line = lineCost(pointOf(p), pointOf(s))
      let best = table.cost(p) + line
      let from = p
      if (line === Infinity || best > gs + 1e-9) {
        eachNeighbor(s, (n, o1, o2) => {
          if (!table.is(n, CLOSED)) return
          const c = table.cost(n) + stepCost(n, s, o1, o2)
          if (c < best) {
            best = c
            from = n
          }
        })
      }
      if (best === Infinity) continue
      table.set(s, best, from)
      gs = best
    }
    table.mark(s, CLOSED)
    if (s === goal) return { table, reached: true }

    const p = table.from(s)
    const gp = table.cost(p)
    const deepFromParent = p !== s && price(p) === DEEP_COST && price(s) === DEEP_COST
    eachNeighbor(s, (n, o1, o2) => {
      if (table.is(n, CLOSED)) return
      const stepped = stepCost(s, n, o1, o2)
      if (stepped === Infinity) return
      let cost = gs + stepped
      let from = s
      let lazy = false
      if (p !== s) {
        const straight = between(p, n)
        if (deepFromParent && price(n) === DEEP_COST) {
          // In deep water the line from the parent is assumed clear, and
          // checked only if this leaf is ever taken off the heap.
          if (gp + straight < cost) {
            cost = gp + straight
            from = p
            lazy = true
          }
        } else if (gp + straight < cost) {
          const line = lineCost(pointOf(p), pointOf(n), cost - gp)
          if (gp + line < cost) {
            cost = gp + line
            from = p
          }
        }
      }
      if (cost < table.cost(n) - 1e-12) {
        const left = estimate(n)
        if (left === Infinity) return
        table.set(n, cost, from)
        table.mark(n, UNCHECKED, lazy)
        heap.push(cost + left, n)
      }
    })
  }
  return { table, reached: false }
}

// How many super-blocks (about 1.2 km each) either side of the rough path the
// fine search looks, widening when it finds no way. One was too tight: into
// Marion the rough path hugs the west shore of the upper bay, and the channel
// is two over.
const CORRIDOR_WIDTHS = [2, 4]

function search(model, roughModel) {
  const { grid, a, b, leafA, leafB, dist, reachA, reachB } = model
  // A leaf is one depth throughout, and square, so the line across it is too.
  if (leafA === leafB) return { points: [a, b] }
  const graph = graphOf(model)

  // Every way into the destination crosses whatever shallow or dry water lies
  // between it and open water, and the search is told so (see harborToll).
  const arrival = harborToll(model, graph, b, leafB, leafA, reachB)
  const departure = harborToll(model, graph, a, leafA, leafB, reachA)
  if (arrival.closedOff || departure.closedOff) {
    return { closedOffA: departure.closedOff, closedOffB: arrival.closedOff }
  }

  // The rough pass, from the destination back to the start. At block scale it
  // is cheap, and it says which way to go: across the Sound a straight line
  // into Peconic Bay runs over the North Fork, and a search cell by cell
  // combed every shore of the Sound finding that out. It knows the shortest
  // way, narrow passes included, but can be fooled by a breakwater, so the
  // fine search runs in a corridor round it, then a wider one, then
  // everywhere.
  const roughPath = (m) => {
    for (const id of [...arrival.wayOut, ...departure.wayOut]) {
      const p = graph.pointOf(id)
      m.harborBlocks.add(m.leafAt(Math.floor(p.y), Math.floor(p.x)))
    }
    const g = graphOf(m)
    const pass = thetaStar(m, g, m.leafB, m.leafA, (id) => {
      const p = g.pointOf(id)
      return WEIGHT * dist(p.y, p.x, a.y, a.x)
    })
    if (!pass.reached) return null
    const points = []
    for (let k = m.leafA; k !== m.leafB; k = pass.table.from(k)) points.push(g.pointOf(k))
    points.push(b)
    return points
  }
  const estimate = (corridor) => (id) => {
    const p = graph.pointOf(id)
    if (corridor && !corridor[(p.y >> 6) * grid.superCols + (p.x >> 6)]) return Infinity
    const d = dist(p.y, p.x, b.y, b.x)
    const known = arrival.exact(id)
    return WEIGHT * (d + (known >= 0 ? known : arrival.tollAt(d)))
  }
  const fine = (corridor) => {
    const found = thetaStar(model, graph, leafA, leafB, estimate(corridor))
    if (!found.reached) return null
    const points = []
    for (let k = leafB; ; k = found.table.from(k)) {
      points.push(graph.pointOf(k))
      if (k === leafA) break
    }
    return points.reverse()
  }

  const path = roughPath(roughModel)
  if (path) {
    for (const width of CORRIDOR_WIDTHS) {
      const points = fine(corridorAround(model, path, width))
      if (points) return { points }
    }
  }
  const points = fine(null)
  return points ? { points } : {}
}

// The super-blocks within `width` of the path, and within a mile of either
// end, where the harbors are, as a mask.
const HARBOR_NM = 1

function corridorAround(model, points, width) {
  const { grid, a, b, dist } = model
  const { superRows, superCols } = grid
  const S = 64
  const mask = new Uint8Array(superRows * superCols)
  const mark = (r, c) => {
    for (let dr = -width; dr <= width; dr++) {
      for (let dc = -width; dc <= width; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr >= 0 && rr < superRows && cc >= 0 && cc < superCols) mask[rr * superCols + cc] = 1
      }
    }
  }
  for (let i = 0; i + 1 < points.length; i++) {
    const p = points[i]
    const q = points[i + 1]
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(q.y - p.y), Math.abs(q.x - p.x)) / (S / 4)))
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      mark(Math.floor((p.y + (q.y - p.y) * t) / S), Math.floor((p.x + (q.x - p.x) * t) / S))
    }
  }
  for (const end of [a, b]) {
    const span = Math.ceil(HARBOR_NM / (S * grid.nmPerRow)) + 1
    const r0 = Math.floor(end.y / S)
    const c0 = Math.floor(end.x / S)
    for (let r = r0 - span; r <= r0 + span; r++) {
      for (let c = c0 - span; c <= c0 + span; c++) {
        if (r < 0 || r >= superRows || c < 0 || c >= superCols) continue
        const dy = Math.max(r * S - end.y, 0, end.y - (r + 1) * S)
        const dx = Math.max(c * S - end.x, 0, end.x - (c + 1) * S)
        if (dist(0, 0, dy, dx) <= HARBOR_NM) mask[r * superCols + c] = 1
      }
    }
  }
  return mask
}

/**
 * The toll for one end of the route: a search out from it that pays only for
 * shallow and dry water, deep water being free, so it runs outward through
 * whatever is open and stops paying once it is clear. Each time it gets
 * further from the dock than it has been, it records how far and what it has
 * paid: what any route arriving from that far away must pay at least. A leaf
 * it settled has its toll exactly, not just the least for its distance: water
 * across a spit from an anchorage is near it, and still the whole way round
 * through the cut from it. Without the toll, a dock with a tenth of a mile of
 * dry cells at the quay (fifty miles, at their price) had the search comb
 * fifty miles of water in every direction before it would believe it was done.
 *
 * If it runs out of water before it is clear of the harbor, the water that end
 * is in is closed off at these allowances, and unless the other end is in
 * there too there is no route: better to know that now than after searching
 * the whole region.
 */
function harborToll(model, graph, end, endLeaf, otherLeaf, reach) {
  const { dist } = model
  const { pointOf, eachNeighbor, stepCost } = graph
  const outNM = (id) => {
    const p = pointOf(id)
    return dist(p.y, p.x, end.y, end.x)
  }
  const table = createLeafTable()
  table.set(endLeaf, 0, -1)
  const heap = createHeap()
  // Ties in what has been paid go to the leaf further out, so open water is
  // crossed in a few long strides rather than combed.
  const TIE = 1e-7
  heap.push(0, endLeaf)
  const record = []
  const settledOrder = []
  let furthest = -1
  let escaped = false
  for (let settled = 0; heap.size > 0; settled++) {
    if (settled > 200000) {
      escaped = true
      break
    }
    const u = heap.pop()
    const paid = table.cost(u)
    const r = outNM(u)
    if (table.is(u, CLOSED) || heap.topKey > paid - TIE * r + 1e-12) continue
    table.mark(u, CLOSED)
    settledOrder.push(u)
    if (r > furthest) {
      furthest = r
      // What was paid is, to within the tie-break, the least any way this far
      // out gets away with.
      record.push({ r, excess: Math.max(0, paid - TIE * 10) })
      if (r > reach.shallowNM + 1) {
        escaped = true
        break
      }
    }
    const pu = pointOf(u)
    eachNeighbor(u, (v, o1, o2) => {
      const stepped = stepCost(u, v, o1, o2)
      if (stepped === Infinity) return
      const pv = pointOf(v)
      const next = paid + Math.max(0, stepped - dist(pu.y, pu.x, pv.y, pv.x))
      if (next < table.cost(v) - 1e-12) {
        table.set(v, next, u)
        heap.push(next - TIE * dist(pv.y, pv.x, end.y, end.x), v)
      }
    })
  }
  const tollAt = (d) => {
    if (record.length === 0 || d <= record[0].r) return record[0]?.excess ?? 0
    let lo = 0
    let hi = record.length - 1
    if (d >= record[hi].r) return record[hi].excess
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (record[mid].r < d) lo = mid
      else hi = mid
    }
    return record[lo].excess
  }
  return {
    tollAt,
    exact: (id) => (table.is(id, CLOSED) ? table.cost(id) : -1),
    // The leaves the way out of the harbor runs through: those it settled for
    // no more than it took to get clear.
    wayOut: settledOrder.filter((id) => table.cost(id) <= (record.at(-1)?.excess ?? 0) + 1e-9),
    closedOff: !escaped && table.cost(otherLeaf) === Infinity,
  }
}

// Pull the path tight. From each point, the furthest point ahead whose
// straight line costs no more than the path it cuts out: out in the Sound,
// that means only through deep water, and near the ends through no more
// shallow or dry water than the path already crosses.
function pullTight(model, points) {
  const { lineCost } = model
  const EPS = 1e-9
  let path = points
  for (let pass = 0; pass < 4; pass++) {
    const legs = []
    for (let i = 0; i + 1 < path.length; i++) legs.push(lineCost(path[i], path[i + 1]))
    const kept = [path[0]]
    let i = 0
    while (i < path.length - 1) {
      let best = i + 1
      let cut = legs[i]
      let misses = 0
      for (let j = i + 2; j < path.length; j++) {
        cut += legs[j - 1]
        if (lineCost(path[i], path[j], cut + EPS) <= cut + EPS) {
          best = j
          misses = 0
        } else if (++misses > PULL_PATIENCE) {
          break
        }
      }
      kept.push(path[best])
      i = best
    }
    if (kept.length === path.length) break
    path = kept
  }
  return path
}

// The finished route, with the stretches of it off deep water measured.
function describe(model, path) {
  const { grid, classOfValue, view } = model
  const stretches = []
  let least = Infinity
  let along = 0
  for (let i = 0; i + 1 < path.length; i++) {
    const p = path[i]
    const q = path[i + 1]
    const legNM = grid.distanceNM(p.y, p.x, q.y, q.x)
    const at = (t) => grid.latLngOf(p.y + (q.y - p.y) * t, p.x + (q.x - p.x) * t)
    let s = 0
    grid.walk(p.y, p.x, q.y, q.x, (id, value, lengthNM) => {
      if (lengthNM <= 0) return
      const cls = classOfValue(value)
      if (cls === DEEP) {
        least = Math.min(least, value)
      } else {
        const kind = cls === SHALLOW ? 'shallow' : 'dry'
        const t0 = legNM > 0 ? s / legNM : 0
        const t1 = legNM > 0 ? (s + lengthNM) / legNM : 1
        const last = stretches.at(-1)
        if (last && last.kind === kind && Math.abs(last.endNM - (along + s)) < 1e-6) {
          // Carried on round a waypoint from the leg before, which is then a
          // corner of it: a line from its start to its end would cut across
          // whatever the route turned to avoid.
          if (s === 0) last.points.push(at(0))
          last.lengthNM += lengthNM
          last.endNM += lengthNM
          last.to = at(t1)
          last.leastValue = Math.min(last.leastValue, value)
        } else {
          stretches.push({
            kind, lengthNM, startNM: along + s, endNM: along + s + lengthNM,
            points: [at(t0)], to: at(t1), leastValue: value,
          })
        }
      }
      s += lengthNM
    }, view)
    along += legNM
  }

  return {
    waypoints: path.map((p) => {
      const { lat, lng } = grid.latLngOf(p.y, p.x)
      return [lat, lng]
    }),
    heldToFt: grid.stepsFt[model.need - 1],
    // The shallowest water the deep part of the route is in, as a charted
    // range: "8 to 10 ft" says more than the 5 it was held to.
    leastDepth: least === Infinity ? null : grid.depthRange(least),
    stretches: stretches.map(({ kind, lengthNM, startNM, endNM, points, to, leastValue }) => ({
      kind,
      lengthNM,
      // Which end of the route a stretch belongs to: they only happen near one.
      end: startNM < along - endNM ? 'start' : 'dest',
      path: [...points, to].map(({ lat, lng }) => [lat, lng]),
      least: grid.depthRange(leastValue),
    })),
  }
}
