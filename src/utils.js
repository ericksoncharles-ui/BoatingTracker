/**
 * Calculate distance between two coordinates in nautical miles using Haversine formula.
 */
export function calcDistanceNM(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const km = R * c
  return km / 1.852 // convert km to nautical miles
}

/**
 * Initial bearing from one coordinate to another, in degrees true (0-360).
 */
export function calcBearing(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

/**
 * Convert a bearing in degrees to a 16-point compass label (e.g. 247 -> "WSW").
 */
export function degreesToCardinal(deg) {
  if (deg == null || Number.isNaN(deg)) return null
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16
  return COMPASS_POINTS[idx]
}

/**
 * Check if a point is within a given distance of a line segment (route).
 * Uses perpendicular distance from point to the line between start and end.
 */
function distanceFromRoute(pointLat, pointLng, startLat, startLng, endLat, endLng) {
  // Project point onto the line segment and find closest point
  const dx = endLng - startLng
  const dy = endLat - startLat
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) return { distance: calcDistanceNM(pointLat, pointLng, startLat, startLng), t: 0 }

  let t = ((pointLng - startLng) * dx + (pointLat - startLat) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const closestLat = startLat + t * dy
  const closestLng = startLng + t * dx

  return { distance: calcDistanceNM(pointLat, pointLng, closestLat, closestLng), t }
}

/**
 * Find no-wake zones that affect a multi-segment route and calculate the time penalty.
 */
export function calcNoWakeDelay(routeWaypoints, noWakeZones, cruisingSpeed) {
  const affectedZones = []
  let totalDelayHours = 0

  for (const zone of noWakeZones) {
    // Check zone against each segment of the route
    let minDist = Infinity
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
      const { distance } = distanceFromRoute(
        zone.lat, zone.lng,
        routeWaypoints[i][0], routeWaypoints[i][1],
        routeWaypoints[i + 1][0], routeWaypoints[i + 1][1]
      )
      if (distance < minDist) minDist = distance
    }

    if (minDist <= zone.radiusNM) {
      const distInZone = Math.min(zone.radiusNM * 2, zone.radiusNM + Math.max(0, zone.radiusNM - minDist))
      const timeAtCruise = distInZone / cruisingSpeed
      const timeAtNoWake = distInZone / zone.speedLimit
      const delay = timeAtNoWake - timeAtCruise

      if (delay > 0) {
        totalDelayHours += delay
        affectedZones.push({
          ...zone,
          distInZone: Math.round(distInZone * 100) / 100,
          delayMinutes: Math.round(delay * 60 * 10) / 10,
        })
      }
    }
  }

  return { totalDelayHours, affectedZones }
}

/**
 * Calculate total distance along a multi-segment route in nautical miles.
 */
export function calcRouteDistanceNM(waypoints) {
  let total = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calcDistanceNM(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1])
  }
  return total
}

/**
 * Calculate trip details from distance and boat parameters, including no-wake zone delays.
 */
export function calcTripDetails(distanceNM, speedKnots, fuelBurnGPH, tankGallons, noWakeDelayHours = 0) {
  const baseTravelTimeHours = distanceNM / speedKnots
  const travelTimeHours = baseTravelTimeHours + noWakeDelayHours
  const hours = Math.floor(travelTimeHours)
  const minutes = Math.round((travelTimeHours - hours) * 60)

  // Fuel: at cruise speed for most of the trip, at idle/no-wake for delay portions
  // No-wake zones burn roughly 1/3 of cruise GPH
  const noWakeFuelRate = fuelBurnGPH * 0.3
  const fuelUsed = (baseTravelTimeHours * fuelBurnGPH) + (noWakeDelayHours * noWakeFuelRate)
  const fuelRemaining = tankGallons - fuelUsed
  const fuelPercentUsed = (fuelUsed / tankGallons) * 100

  return {
    travelTimeHours,
    travelTimeFormatted: `${hours}h ${minutes}m`,
    fuelUsed: Math.round(fuelUsed * 10) / 10,
    fuelRemaining: Math.round(fuelRemaining * 10) / 10,
    fuelPercentUsed: Math.round(fuelPercentUsed),
    needsFuelWarning: fuelPercentUsed > 70,
    noWakeDelayMinutes: Math.round(noWakeDelayHours * 60),
  }
}

// Width of navigable water either side of a channel leg, where the leg's own
// waypoints don't say. Six miles is the open Sound; a waypoint in a bay or a
// hole carries a narrower corridorNM of its own (see navigationSpine).
const DEFAULT_CORRIDOR_NM = 6

// A direct approach-to-approach line this short skips the channel graph
// entirely: two harbors on the same shore don't need a mid-Sound waypoint
// between them. It only skips the *graph*, never the land check — six miles
// separates Orient Point from Greenport with the North Fork in between.
const SHORT_HOP_NM = 10

const dist = (a, b) => calcDistanceNM(a.lat, a.lng, b.lat, b.lng)

/**
 * Turn the spine and its branches into an undirected graph of channel
 * waypoints.
 *
 * A single west-to-east chain was enough while this only planned trips on the
 * Sound. It is not enough for Narragansett Bay, which splits either side of
 * Conanicut Island, or for Buzzards Bay, which is reached from Vineyard Sound
 * only through a hole in the Elizabeth Islands. So branches hang off the spine
 * (`from`) and may rejoin it (`to`), and the route is the shortest walk through
 * whatever that produces.
 *
 * A `from`/`to` naming a waypoint that doesn't exist leaves the branch
 * unreachable rather than throwing — route:probe reports those.
 */
export function buildChannelGraph(spine, branches = []) {
  const nodes = []
  const adj = []
  const byId = new Map()

  const addNode = (wp) => {
    const idx = nodes.length
    nodes.push({
      id: wp.id,
      lat: wp.lat,
      lng: wp.lng,
      corridorNM: wp.corridorNM ?? DEFAULT_CORRIDOR_NM,
    })
    adj.push([])
    byId.set(wp.id, idx)
    return idx
  }

  const link = (a, b) => {
    if (a == null || b == null || a === b) return
    const d = dist(nodes[a], nodes[b])
    adj[a].push({ to: b, d })
    adj[b].push({ to: a, d })
  }

  let previous = null
  for (const wp of spine) {
    const idx = addNode(wp)
    link(previous, idx)
    previous = idx
  }

  // Every waypoint exists before any branch is joined up, so a branch can
  // leave from or rejoin one declared further down the list. Joining as they
  // were read used to drop a `to` naming a later branch without a word, which
  // left the Sag Harbor channel a dead end.
  const chains = branches.map((branch) => branch.waypoints.map(addNode))
  branches.forEach((branch, b) => {
    let anchor = byId.get(branch.from)
    for (const idx of chains[b]) {
      link(anchor, idx)
      anchor = idx
    }
    if (branch.to != null) link(anchor, byId.get(branch.to))
  })

  // Every leg, with the width of water around it — the narrower end governs,
  // since that is the constraint a boat on the leg actually meets.
  const legs = []
  for (let a = 0; a < adj.length; a++) {
    for (const edge of adj[a]) {
      if (edge.to > a) {
        legs.push({
          a: nodes[a],
          b: nodes[edge.to],
          widthNM: Math.min(nodes[a].corridorNM, nodes[edge.to].corridorNM),
        })
      }
    }
  }

  return { nodes, adj, legs }
}

/**
 * Shortest distances from one node to every other, over the channel graph.
 * Dense Dijkstra: the graph is a few dozen waypoints, so the scan costs less
 * than a heap would.
 */
function channelDistances(adj, source) {
  const distances = new Array(adj.length).fill(Infinity)
  const previous = new Array(adj.length).fill(-1)
  const settled = new Array(adj.length).fill(false)
  distances[source] = 0

  for (;;) {
    let u = -1
    let bestDist = Infinity
    for (let i = 0; i < adj.length; i++) {
      if (!settled[i] && distances[i] < bestDist) {
        bestDist = distances[i]
        u = i
      }
    }
    if (u === -1) break
    settled[u] = true
    for (const edge of adj[u]) {
      const through = distances[u] + edge.d
      if (through < distances[edge.to]) {
        distances[edge.to] = through
        previous[edge.to] = u
      }
    }
  }

  return { distances, previous }
}

// A headland's radiusNM is a detection circle: the land plus enough margin that
// a course shaving the tip still trips it (applyLandAvoidance adds another 0.3
// NM on top). Rejecting a course outright is a stronger claim, so it goes on the
// core of the circle — radius less that same margin — which is the part that is
// unambiguously land. Without this, crossing the mouth of Huntington Bay half a
// mile off the Eatons Neck beach reads as driving over the neck.
const LAND_MARGIN_NM = 0.3

// A leg is only judged by how close it gets to a hazard *beyond* its own ends.
// An approach waypoint can legitimately sit near the land or shoal it is the way
// around, and an inserted bypass sits just outside its circle by design; what
// matters is whether the line between them gets closer still. This used to be
// "ignore the first and last 2% of the leg", which on a seventy-mile leg waved
// through a mile and a half at each end: enough to run over Greens Ledge on the
// way into Darien.
const ENDPOINT_SLACK_NM = 0.05

function passesInside(hazard, a, b, limitNM) {
  const { distance } = distanceFromRoute(hazard.lat, hazard.lng, a.lat, a.lng, b.lat, b.lng)
  if (distance >= limitNM) return false
  const nearestEnd = Math.min(dist(a, hazard), dist(b, hazard))
  return distance < nearestEnd - ENDPOINT_SLACK_NM
}

/**
 * True when a straight line from a to b runs over land: through the core of one
 * of the keep-out circles in `headlands`, or across the real shoreline when a
 * `coast` (see coastline.js) is supplied. The circles only know the land someone
 * drew; the shoreline knows the rest, from Fishers Island to the barrier beaches.
 */
function crossesLand(a, b, landAreas, coast) {
  for (const land of landAreas) {
    if (passesInside(land, a, b, Math.max(0.15, land.radiusNM - LAND_MARGIN_NM))) return true
  }
  return coast ? coast.crossesLand(a, b) : false
}

// Two harbors ten miles apart can have islands between them that no channel
// waypoint was ever placed for: the Norwalk Islands, the Thimbles. With the
// shoreline enforced, the straight line between them is refused and the channel
// graph's answer can be three times the distance. So for a hop this short the
// router also looks for the way through itself, on a grid over the real
// shoreline, and takes it when it beats the graph.
const DETOUR_MAX_NM = 15

// Sixteen directions, so a grid path isn't limited to 45-degree zigzags before
// it is pulled tight.
const GRID_MOVES = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
  [-1, -2], [-1, 2], [1, -2], [1, 2], [-2, -1], [-2, 1], [2, -1], [2, 1],
]

// A path pulled tight round an island runs along its beach, which is where the
// rocks are. The detour keeps this much water between itself and the shore,
// except in the first and last stretch, where an approach waypoint is close to
// its harbor by design.
const DETOUR_CLEARANCE_NM = 0.1
const DETOUR_END_GRACE_NM = 0.3

/**
 * Shortest way from a to b that stays off the land, found by A* over a local
 * grid of water points and then pulled tight, or null when there is none
 * shorter than `limitNM`. `blocked(p, q)` is the router's own land test, so the
 * answer respects the same shoreline and headland circles as everything else;
 * `avoid` is circles of water that count as dry here too, for a way round a
 * reef.
 */
function findWaterPath(a, b, blocked, coast, limitNM, avoid = []) {
  const direct = dist(a, b)
  if (!coast || direct > DETOUR_MAX_NM) return null

  const stepNM = Math.min(0.25, Math.max(0.1, direct / 40))
  const marginNM = Math.min(3, Math.max(1, direct / 2))
  const cosLat = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)

  // A line keeps its clearance when it doesn't cross land and neither do the
  // two lines DETOUR_CLEARANCE_NM either side of it.
  const clearLine = (p, q) => {
    if (blocked(p, q)) return false
    const east = (q.lng - p.lng) * 60 * cosLat
    const north = (q.lat - p.lat) * 60
    const len = Math.hypot(east, north)
    if (len === 0) return true
    const grace = p === a || p === b || q === a || q === b ? DETOUR_END_GRACE_NM : 0
    for (const side of [1, -1]) {
      const offLat = (side * (-east / len) * DETOUR_CLEARANCE_NM) / 60
      const offLng = (side * (north / len) * DETOUR_CLEARANCE_NM) / (60 * cosLat)
      const p2 = { lat: p.lat + offLat, lng: p.lng + offLng }
      const q2 = { lat: q.lat + offLat, lng: q.lng + offLng }
      if (coast.crossesLand(p2, q2, grace)) return false
    }
    return true
  }
  // The grid covers the line with a margin, and has to reach round anything
  // near it that counts as dry: Sow and Pigs reaches further west of Cuttyhunk
  // than any margin sized to the hop from the harbor.
  const near = avoid.filter((c) =>
    distanceFromRoute(c.lat, c.lng, a.lat, a.lng, b.lat, b.lng).distance < c.radiusNM + marginNM)
  let south = Math.min(a.lat, b.lat)
  let north = Math.max(a.lat, b.lat)
  let west = Math.min(a.lng, b.lng)
  let east = Math.max(a.lng, b.lng)
  for (const c of near) {
    south = Math.min(south, c.lat - c.radiusNM / 60)
    north = Math.max(north, c.lat + c.radiusNM / 60)
    west = Math.min(west, c.lng - c.radiusNM / (60 * cosLat))
    east = Math.max(east, c.lng + c.radiusNM / (60 * cosLat))
  }
  const dLat = stepNM / 60
  const dLng = stepNM / (60 * cosLat)
  const minLat = south - marginNM / 60
  const minLng = west - marginNM / (60 * cosLat)
  const rows = Math.ceil((north + marginNM / 60 - minLat) / dLat) + 1
  const cols = Math.ceil((east + marginNM / (60 * cosLat) - minLng) / dLng) + 1

  const cells = rows * cols
  const A = cells
  const B = cells + 1
  const point = (k) =>
    k === A ? a : k === B ? b : { lat: minLat + Math.floor(k / cols) * dLat, lng: minLng + (k % cols) * dLng }
  const cellOf = (p) => [Math.round((p.lat - minLat) / dLat), Math.round((p.lng - minLng) / dLng)]

  // A grid point counts as water only with water around it too.
  const wet = new Int8Array(cells)
  const clearLat = DETOUR_CLEARANCE_NM / 60
  const clearLng = DETOUR_CLEARANCE_NM / (60 * cosLat)
  const isWater = (k) => {
    if (k >= cells) return true
    if (wet[k] === 0) {
      const p = point(k)
      const dry = coast.isLand(p.lat, p.lng)
        || coast.isLand(p.lat + clearLat, p.lng) || coast.isLand(p.lat - clearLat, p.lng)
        || coast.isLand(p.lat, p.lng + clearLng) || coast.isLand(p.lat, p.lng - clearLng)
        || near.some((c) => dist(p, c) < c.radiusNM)
      wet[k] = dry ? -1 : 1
    }
    return wet[k] === 1
  }

  // The two approaches join the grid through the cells around them.
  const nearCells = (p) => {
    const [r, c] = cellOf(p)
    const out = []
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols) out.push((r + dr) * cols + c + dc)
      }
    }
    return out
  }
  const bCells = new Set(nearCells(b))

  const g = new Float64Array(cells + 2).fill(Infinity)
  const previous = new Int32Array(cells + 2).fill(-1)
  const heap = []
  const push = (f, k) => {
    heap.push([f, k])
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (heap[parent][0] <= heap[i][0]) break
      ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
      i = parent
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length > 0) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }

  g[A] = 0
  push(direct, A)
  while (heap.length > 0) {
    const [f, k] = pop()
    if (f >= limitNM) return null
    if (k === B) break
    if (f > g[k] + dist(point(k), b) + 1e-9) continue

    let next
    if (k === A) {
      next = nearCells(a)
    } else {
      const r = Math.floor(k / cols)
      const c = k % cols
      next = []
      for (const [dr, dc] of GRID_MOVES) {
        if (r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols) next.push((r + dr) * cols + c + dc)
      }
      if (bCells.has(k)) next.push(B)
    }

    const from = point(k)
    for (const n of next) {
      if (!isWater(n)) continue
      const to = point(n)
      const cost = g[k] + dist(from, to)
      // The land test is most of the work here, so it waits until the hop
      // would actually improve on what is known.
      if (cost >= g[n]) continue
      // The hops on and off the grid only have to stay off the land: the
      // approach at either end can be closer to shore than the clearance.
      const ok = k === A || n === B ? !blocked(from, to) : clearLine(from, to)
      if (!ok) continue
      g[n] = cost
      previous[n] = k
      push(cost + dist(to, b), n)
    }
  }
  if (previous[B] === -1) return null

  const path = []
  for (let k = B; k !== -1; k = previous[k]) path.unshift(point(k))

  // Pull the grid path tight: from each point, jump to the furthest one still
  // in plain sight across the water, with the clearance kept.
  const pulled = [path[0]]
  for (let i = 0; i < path.length - 1;) {
    let j = path.length - 1
    while (j > i + 1 && !clearLine(path[i], path[j])) j -= 1
    pulled.push(path[j])
    i = j
  }

  let length = 0
  for (let i = 1; i < pulled.length; i++) length += dist(pulled[i - 1], pulled[i])
  return length < limitNM ? { length, points: pulled.slice(1, -1) } : null
}

/**
 * Build the most direct practical route between two places.
 *
 * The channel graph marks safe open water down the middle of the run. Rather
 * than always riding it between the nearest snap points (which produces
 * dog-legs and overshoot), evaluate the shortest walk through the graph from
 * the nearest entry waypoints to the nearest exit ones, plus the direct
 * approach-to-approach line, and take whichever is shortest. Open-water
 * crossings are real, so the direct line wins whenever it beats the channel
 * path and stays in navigable water.
 *
 * `coast` is the shoreline from coastline.js. Without it only the `landAreas`
 * circles stand between a shortcut and the land, which is how routes came to
 * cross Fishers Island; the probes and the app always pass it.
 */
export function buildRouteWaypoints(start, dest, spine, branches = [], landAreas = [], coast = null) {
  const startApproach = start.approach || { lat: start.lat, lng: start.lng }
  const destApproach = dest.approach || { lat: dest.lat, lng: dest.lng }

  const graph = buildChannelGraph(spine, branches)
  const { nodes, adj, legs } = graph

  // A straight segment is considered safe open water when every point along it
  // stays inside the corridor of some channel leg. Headlands like Eatons Neck,
  // and the Elizabeth Islands two miles off the Vineyard Sound channel, lie
  // outside every corridor. Points within APPROACH_NM of either segment
  // endpoint are exempt — endpoints are curated approach waypoints, so the
  // water immediately around them is known navigable.
  const APPROACH_NM = 2
  const inCorridor = (a, b) => {
    const legNM = dist(a, b)
    const samples = Math.max(2, Math.ceil(legNM))
    for (let s = 0; s <= samples; s++) {
      const t = s / samples
      const p = {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      }
      if (dist(p, a) <= APPROACH_NM || dist(p, b) <= APPROACH_NM) continue
      const covered = legs.some((leg) => {
        const { distance } = distanceFromRoute(p.lat, p.lng, leg.a.lat, leg.a.lng, leg.b.lat, leg.b.lng)
        return distance <= leg.widthNM
      })
      if (!covered) return false
    }
    return true
  }

  const blocked = (a, b) => crossesLand(a, b, landAreas, coast)

  // Entry/exit is limited to the nearest couple of channel waypoints — long
  // diagonal entry legs can cut across headlands (e.g. Eatons Neck), while the
  // short hop out to the nearest channel points is a safe approach corridor.
  // Nearest by distance is not enough on its own: from inside Northport Bay the
  // closest waypoints are out in the Sound, on the far side of the Asharoken
  // spit. So the hop has to be clear of land too, and only when none of the
  // nearby waypoints is does it fall back to the nearest, for route:probe to
  // report.
  const ENTRY_SEARCH = 6
  const nearestIndices = (pt, count) => {
    const ranked = nodes
      .map((node, idx) => ({ idx, d: dist(pt, node) }))
      .sort((a, b) => a.d - b.d)
    const clear = ranked.slice(0, ENTRY_SEARCH).filter((entry) => !blocked(pt, nodes[entry.idx]))
    return (clear.length > 0 ? clear : ranked).slice(0, count).map((entry) => entry.idx)
  }

  const entryCandidates = nearestIndices(startApproach, 2)
  const exitCandidates = nearestIndices(destApproach, 2)

  // Best route via the channels: enter at i, work through the graph, exit at j
  let best = { length: Infinity, points: [] }
  for (const i of entryCandidates) {
    const { distances, previous } = channelDistances(adj, i)
    const entry = dist(startApproach, nodes[i])
    for (const j of exitCandidates) {
      const length = entry + distances[j] + dist(nodes[j], destApproach)
      if (length < best.length) {
        const walked = []
        for (let k = j; k !== -1; k = previous[k]) {
          walked.unshift([nodes[k].lat, nodes[k].lng])
          if (k === i) break
        }
        best = { length, points: walked }
      }
    }
  }

  // Direct crossing beats the channels when it stays in a corridor, or when it
  // is a short hop between harbors on the same shore. Either way it has to not
  // run over land; when land is all that stands in the way of a short hop, look
  // for the way round it before settling for the channels.
  const directDist = dist(startApproach, destApproach)
  if (directDist < best.length) {
    if (!blocked(startApproach, destApproach)) {
      if (directDist < SHORT_HOP_NM || inCorridor(startApproach, destApproach)) {
        best = { length: directDist, points: [] }
      }
    } else {
      // The corridor test says where a straight line may cut across; a detour
      // is built on the shoreline itself, so it only has to be shorter.
      const detour = findWaterPath(startApproach, destApproach, blocked, coast, best.length)
      if (detour) best = { length: detour.length, points: detour.points.map((p) => [p.lat, p.lng]) }
    }
  }

  // Greedy shortcut pass: skip ahead past intermediate points whenever the
  // straight chord stays inside the open-water corridor and clear of land. The
  // land check is what keeps a shortcut from cutting the corner off Cuttyhunk or
  // Sakonnet Point — both sit a mile or two off a channel, well inside its
  // corridor, which is exactly the width a shortcut is allowed to stray.
  const path = [
    startApproach,
    ...best.points.map(([lat, lng]) => ({ lat, lng })),
    destApproach,
  ]
  const smoothed = [path[0]]
  let i = 0
  while (i < path.length - 1) {
    let next = i + 1
    for (let j = path.length - 1; j > i + 1; j--) {
      if (inCorridor(path[i], path[j]) && !blocked(path[i], path[j])) {
        next = j
        break
      }
    }
    smoothed.push(path[next])
    i = next
  }

  return [
    [start.lat, start.lng],
    ...smoothed.map((p) => [p.lat, p.lng]),
    [dest.lat, dest.lng],
  ]
}

// Each pass inserts one detour and starts over, so this caps the detours on one
// route. A run from the Sound to Nantucket passes a dozen charted hazards; the
// old cap of six quietly left the rest of them on the course.
const MAX_BYPASSES = 40

// How far either side of its closest approach a route is rerouted when a reef
// has land close enough on both sides that a single detour point won't do,
// and how far that may stretch when the route is still on the reef there.
const AROUND_REACH_NM = 3
const AROUND_REACH_MAX_NM = 6

// A hazard's keep-out zone stops this far short of an approach waypoint.
const ZONE_EDGE_NM = 0.02

/**
 * The point `reachNM` along the route from `from`, a point on leg i, walking
 * back (dir -1) or ahead (dir 1), with the leg it lands on. The walk stops at
 * the approach waypoints: the legs beyond them are the curated harbor legs.
 */
function walkRoute(pts, i, from, reachNM, dir) {
  let leg = i
  let at = from
  let left = reachNM
  for (;;) {
    const end = dir < 0 ? pts[leg] : pts[leg + 1]
    const d = dist(at, end)
    if (d > left) {
      const f = left / d
      return { leg, point: { lat: at.lat + (end.lat - at.lat) * f, lng: at.lng + (end.lng - at.lng) * f } }
    }
    left -= d
    at = end
    if (dir < 0 ? leg === 1 : leg + 1 === pts.length - 2) return { leg, point: end, atApproach: true }
    leg += dir
  }
}

/**
 * The way round a hazard on the water, for a leg whose one-point detour would
 * go aground on either side. The stretch of route AROUND_REACH_NM either side
 * of where leg i passes closest to `zone` is replaced by the water path between
 * its two ends that keeps off the land and out of every hazard's zone. It is
 * the stretch and not the leg because the router's own detour round a point
 * can put a waypoint on the reef off it: Dumpling Rocks, off Round Hill on the
 * way into Padanaram. Returns the whole new route, or null when there is no
 * way round.
 *
 * Both ends of the stretch have to be clear of every zone, not just this
 * one's, and no zone is ever left out of the search to make that so. Leaving
 * out the one City Island's approach sits in sent the way round Execution Rocks
 * straight across Stepping Stones.
 */
function aroundHazard(pts, i, zone, zones, coast) {
  const a = pts[i]
  const b = pts[i + 1]
  const { t } = distanceFromRoute(zone.lat, zone.lng, a.lat, a.lng, b.lat, b.lng)
  const closest = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
  const clear = (end) => end.atApproach || zones.every((z) => dist(end.point, z) >= z.radiusNM)
  const walk = (dir) => {
    let end
    for (let reach = AROUND_REACH_NM; reach <= AROUND_REACH_MAX_NM; reach += 1) {
      end = walkRoute(pts, i, closest, reach, dir)
      if (clear(end)) break
    }
    return end
  }
  const back = walk(-1)
  const ahead = walk(1)
  if (!clear(back) || !clear(ahead)) return null

  const circles = zones.filter((z) => z.radiusNM > 0)
  const blocked = (p, q) => coast.crossesLand(p, q)
    || circles.some((c) => distanceFromRoute(c.lat, c.lng, p.lat, p.lng, q.lat, q.lng).distance < c.radiusNM)

  const path = findWaterPath(back.point, ahead.point, blocked, coast, Infinity, circles)
  if (!path) return null
  return [
    ...pts.slice(0, back.leg + 1),
    ...(back.atApproach ? [] : [back.point]),
    ...path.points,
    ...(ahead.atApproach ? [] : [ahead.point]),
    ...pts.slice(ahead.leg + 1),
  ]
}

/**
 * Detour a route around circular hazards (shoals or headlands). Any hazard
 * the route passes within radiusNM + buffer of (its zone, below) gets a bypass
 * waypoint pushed just outside that radius, on the side the route already favors.
 * The first and last legs (marina to approach waypoint) are left alone —
 * those are curated harbor approaches.
 *
 * With a `coast`, a computed detour that would put the boat on the beach is
 * taken round the other side of the hazard instead. A reef close inshore is
 * the common case: the route passes it on the landward side, and "further the
 * same way" is further up the beach.
 */
function insertHazardBypasses(waypoints, hazards, buffer, coast = null) {
  const pts = waypoints.map(([lat, lng]) => ({ lat, lng }))
  const avoided = []
  const noteAvoided = (s) => {
    if (!avoided.some((x) => x.id === s.id)) avoided.push(s)
  }
  // Hazards the route still passes with no way round on the water. Reported
  // rather than hidden: the boat is still being sent past them.
  const unavoided = []

  // What the route keeps out of for each hazard: its circle and the buffer,
  // drawn in where it has to be to leave both approach waypoints outside. An
  // approach is curated and has to be reached whatever lies near it: City
  // Island's is in the margin round Stepping Stones, and a lighthouse's is on
  // its reef. The approaches never move, so neither do the zones.
  const first = pts[1]
  const last = pts[pts.length - 2]
  const zoneOf = new Map(hazards.map((s) => [s.id, {
    lat: s.lat,
    lng: s.lng,
    radiusNM: Math.min(s.radiusNM + buffer, dist(first, s) - ZONE_EDGE_NM, dist(last, s) - ZONE_EDGE_NM),
  }]))
  const zones = [...zoneOf.values()]

  let changed = true
  let iter = 0
  while (changed && iter++ < MAX_BYPASSES) {
    changed = false
    for (let i = 1; i < pts.length - 2 && !changed; i++) {
      for (const s of hazards) {
        // A curated bypass point is a single known-safe waypoint, not a
        // direction to push away from — once a hazard has contributed one,
        // the leg leading into it can legitimately still pass close by
        // without needing (or being able to usefully take) a second detour.
        if (s.bypass && avoided.some((x) => x.id === s.id)) continue
        if (unavoided.some((x) => x.id === s.id)) continue
        const zone = zoneOf.get(s.id)
        // A waypoint inside the zone itself, like the router's own detour
        // pulled tight round Round Hill and ending on Dumpling Rocks. Neither of
        // its legs passes any closer than that waypoint, so the leg test never
        // fires, and pushing a leg aside would leave the waypoint on the reef.
        const inside = !s.bypass && i + 1 < pts.length - 2 && dist(pts[i + 1], s) < zone.radiusNM
        if (!inside && !passesInside(s, pts[i], pts[i + 1], zone.radiusNM)) continue

        let bypassPoint
        if (s.bypass) {
          // Land only has water on one side — route through the curated
          // safe point instead of guessing a direction off the center.
          bypassPoint = { lat: s.bypass.lat, lng: s.bypass.lng }
        } else {
          const { t } = distanceFromRoute(
            s.lat, s.lng,
            pts[i].lat, pts[i].lng,
            pts[i + 1].lat, pts[i + 1].lng
          )
          const cLat = pts[i].lat + t * (pts[i + 1].lat - pts[i].lat)
          const cLng = pts[i].lng + t * (pts[i + 1].lng - pts[i].lng)
          const cosLat = Math.cos((s.lat * Math.PI) / 180)
          // Direction from hazard center toward the route, in NM space
          let vLat = (cLat - s.lat) * 60
          let vLng = (cLng - s.lng) * 60 * cosLat
          let len = Math.hypot(vLat, vLng)
          if (len < 1e-6) {
            // Leg passes through the center — deflect perpendicular to it
            vLat = -(pts[i + 1].lng - pts[i].lng)
            vLng = pts[i + 1].lat - pts[i].lat
            len = Math.hypot(vLat, vLng) || 1
          }
          const targetNM = s.radiusNM + buffer + 0.05
          const side = (sign) => ({
            lat: s.lat + ((sign * vLat) / len) * targetNM / 60,
            lng: s.lng + ((sign * vLng) / len) * targetNM / (60 * cosLat),
          })
          const aground = (p) => coast && (coast.crossesLand(pts[i], p) || coast.crossesLand(p, pts[i + 1]))
          bypassPoint = side(1)
          if (aground(bypassPoint)) bypassPoint = side(-1)
          if (inside || aground(bypassPoint)) {
            // Land close on both sides of the reef, like Greens Ledge between
            // Sheffield Island and the Darien shore: find the way through on
            // the water instead of putting the boat on a beach. A detour onto
            // land is no answer, so with no way round the leg stays as it is.
            const around = coast && aroundHazard(pts, i, zone, zones, coast)
            if (!around) {
              unavoided.push(s)
              continue
            }
            pts.splice(0, pts.length, ...around)
            noteAvoided(s)
            changed = true
            break
          }
        }

        // A curated bypass can land on a waypoint the route already goes
        // through — Quicks Hole is both a channel waypoint and the way around
        // Nashawena. Inserting it again would leave a zero-length leg, and
        // counting it as a change would restart the scan on this same leg
        // forever, so every hazard further along never got looked at.
        const duplicate =
          dist(bypassPoint, pts[i]) < 0.05 || dist(bypassPoint, pts[i + 1]) < 0.05
        if (duplicate) {
          if (s.bypass) noteAvoided(s)
          continue
        }
        pts.splice(i + 1, 0, bypassPoint)
        noteAvoided(s)
        changed = true
        break
      }
    }
  }

  return { waypoints: pts.map((p) => [p.lat, p.lng]), avoided, unavoided }
}

// Water to keep under the keel, in feet at MLW. Both the shoal detours and the
// harbor-approach draft warning measure against it, so a boat is never routed
// round a 5 ft shoal and then waved into a 5 ft harbor.
export const KEEL_CLEARANCE_FT = 2

/**
 * Detour a route around shoal areas that are too shallow for the boat.
 * Only hazards with charted depth < draft + clearance are treated as active.
 */
export function applyShoalAvoidance(waypoints, shoals, draftFt, { clearanceFt = KEEL_CLEARANCE_FT, coast = null } = {}) {
  const active = shoals.filter((s) => s.minDepthFt < draftFt + clearanceFt)
  return insertHazardBypasses(waypoints, active, 0.25, coast)
}

/**
 * Detour a route around headlands/peninsulas. Unlike shoals these are land,
 * not a depth hazard, so every headland is always active regardless of draft.
 */
export function applyLandAvoidance(waypoints, headlands) {
  return insertHazardBypasses(waypoints, headlands, 0.3)
}

// How far off the track something can be and still count as being on the way.
// Roughly a detour a skipper would actually make for lunch.
const POI_NEAR_ROUTE_NM = 12

/**
 * Find POIs along the route, nearest the track first.
 *
 * Measured against the plotted route rather than the straight line's midpoint:
 * on a run from Stamford to Nantucket the midpoint is out in Rhode Island Sound
 * and the Thimble Islands the boat passes on the way would never make the list.
 * Anything more than POI_NEAR_ROUTE_NM off the track is dropped rather than
 * padded in — a lighthouse fifty miles away is not a stop along the way.
 */
export function findNearbyPOIs(routeWaypoints, allPOIs, maxCount = 5) {
  const withDistance = allPOIs.map((poi) => {
    let nearest = Infinity
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
      const { distance } = distanceFromRoute(
        poi.lat, poi.lng,
        routeWaypoints[i][0], routeWaypoints[i][1],
        routeWaypoints[i + 1][0], routeWaypoints[i + 1][1]
      )
      if (distance < nearest) nearest = distance
    }
    return { ...poi, distFromRoute: Math.round(nearest * 10) / 10 }
  })

  return withDistance
    .filter((poi) => poi.distFromRoute <= POI_NEAR_ROUTE_NM)
    .sort((a, b) => a.distFromRoute - b.distFromRoute)
    .slice(0, maxCount)
}
