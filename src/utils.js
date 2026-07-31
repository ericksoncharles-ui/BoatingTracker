import {
  directCourseIsClear, findWaterPath, furthestClearTarget, courseClearance, SHORTCUT_CLEARANCES,
} from './services/waterRouter.js'

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

  for (const branch of branches) {
    let anchor = byId.get(branch.from)
    for (const wp of branch.waypoints) {
      const idx = addNode(wp)
      link(anchor, idx)
      anchor = idx
    }
    if (branch.to != null) link(anchor, byId.get(branch.to))
  }

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

/**
 * True when a straight line from a to b runs over land — through the core of one
 * of the keep-out circles in `headlands`. Endpoints themselves are ignored: an
 * approach waypoint can legitimately sit close to the land it is the way around.
 */
function crossesLand(a, b, landAreas) {
  for (const land of landAreas) {
    const core = Math.max(0.15, land.radiusNM - LAND_MARGIN_NM)
    const { distance, t } = distanceFromRoute(land.lat, land.lng, a.lat, a.lng, b.lat, b.lng)
    if (t > 0.02 && t < 0.98 && distance < core) return true
  }
  return false
}

/**
 * Build the most direct practical route between two places.
 *
 * The course between the two approach waypoints is searched over the real
 * coastline (see services/waterRouter.js): the straight line wins when it is
 * navigable, and otherwise the shortest path that stays in the water does. The
 * channel graph below is kept for the case where the coastline data cannot
 * answer — a position outside the covered box — and its corridors still
 * describe where the deep water runs.
 *
 * `hazards` are circles the boat must stay out of on top of land: the shoals it
 * cannot clear at its draft. Passing them here rather than detouring around
 * them afterwards is what makes "shortest water route" and "deep enough for
 * this boat" the same search instead of two passes that can undo each other.
 */
export function buildRouteWaypoints(start, dest, spine, branches = [], landAreas = [], hazards = []) {
  const startApproach = start.approach || { lat: start.lat, lng: start.lng }
  const destApproach = dest.approach || { lat: dest.lat, lng: dest.lng }

  // Marks a route as already checked against the coastline, so planRoute leaves
  // the circle-based bypass passes off it.
  const tagSearched = (waypoints) => Object.defineProperty(waypoints, 'searched', { value: true })

  // A straight shot between the approaches, when the water allows it, is both
  // the shortest course and the one a skipper would steer.
  // The straight shot has to keep proper water under it, not merely miss the
  // land. Where it doesn't, the search takes over — it will come back with the
  // same line when that really is the best water, and with an offing when it
  // isn't.
  if (courseClearance(startApproach, destApproach) >= SHORTCUT_CLEARANCES[0] &&
      directCourseIsClear(startApproach, destApproach, hazards)) {
    return tagSearched([
      [start.lat, start.lng],
      [startApproach.lat, startApproach.lng],
      [destApproach.lat, destApproach.lng],
      [dest.lat, dest.lng],
    ])
  }

  const watered = findWaterPath(startApproach, destApproach, hazards)
  if (watered && watered.length > 0) {
    // Stitch the curated approach waypoints onto either end of the searched
    // path, then run the same line-of-sight pass over the join.
    //
    // The join is where this goes wrong if it is done by eye. The search starts
    // at the nearest open water to the approach, which for a harbor up a river
    // is not the approach; dropping that first point because it is "close
    // enough" swings the far end of the next leg, and a couple of hundred
    // metres at the Bridgeport end is Stratford Point eight miles down the
    // course. So a point is only dropped when the chord that replaces it is
    // itself clear.
    const points = [
      startApproach,
      ...watered.map(([lat, lng]) => ({ lat, lng })),
      destApproach,
    ]
    const kept = [points[0]]
    let i = 0
    while (i < points.length - 1) {
      const next = furthestClearTarget(points, i, hazards)
      kept.push(points[next])
      i = next
    }

    return tagSearched([
      [start.lat, start.lng],
      ...kept.map((p) => [p.lat, p.lng]),
      [dest.lat, dest.lng],
    ])
  }

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

  // Entry/exit is limited to the nearest couple of channel waypoints — long
  // diagonal entry legs can cut across headlands (e.g. Eatons Neck), while the
  // short hop out to the nearest channel points is a safe approach corridor.
  const nearestIndices = (pt, count) =>
    nodes
      .map((node, idx) => ({ idx, d: dist(pt, node) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((entry) => entry.idx)

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
  // run over land.
  const directDist = dist(startApproach, destApproach)
  if (directDist < best.length && (directDist < SHORT_HOP_NM || inCorridor(startApproach, destApproach))
      && !crossesLand(startApproach, destApproach, landAreas)) {
    best = { length: directDist, points: [] }
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
      if (inCorridor(path[i], path[j]) && !crossesLand(path[i], path[j], landAreas)) {
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

/**
 * Detour a route around circular hazards (shoals or headlands). Any hazard
 * the route passes within radiusNM + buffer of gets a bypass waypoint
 * pushed just outside that radius, on the side the route already favors.
 * The first and last legs (marina to approach waypoint) are left alone —
 * those are curated harbor approaches.
 */
function insertHazardBypasses(waypoints, hazards, buffer) {
  const pts = waypoints.map(([lat, lng]) => ({ lat, lng }))
  const avoided = []

  let changed = true
  let iter = 0
  while (changed && iter++ < 6) {
    changed = false
    for (let i = 1; i < pts.length - 2 && !changed; i++) {
      for (const s of hazards) {
        // A curated bypass point is a single known-safe waypoint, not a
        // direction to push away from — once a hazard has contributed one,
        // the leg leading into it can legitimately still pass close by
        // without needing (or being able to usefully take) a second detour.
        if (s.bypass && avoided.some((x) => x.id === s.id)) continue
        const { distance, t } = distanceFromRoute(
          s.lat, s.lng,
          pts[i].lat, pts[i].lng,
          pts[i + 1].lat, pts[i + 1].lng
        )
        if (t > 0.02 && t < 0.98 && distance < s.radiusNM + buffer) {
          let bypassPoint
          if (s.bypass) {
            // Land only has water on one side — route through the curated
            // safe point instead of guessing a direction off the center.
            bypassPoint = { lat: s.bypass.lat, lng: s.bypass.lng }
          } else {
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
            bypassPoint = {
              lat: s.lat + ((vLat / len) * targetNM) / 60,
              lng: s.lng + ((vLng / len) * targetNM) / (60 * cosLat),
            }
          }
          // A curated bypass can land on a waypoint the route already goes
          // through — Quicks Hole is both a channel waypoint and the way around
          // Nashawena. Inserting it again would leave a zero-length leg.
          const duplicate =
            dist(bypassPoint, pts[i]) < 0.05 || dist(bypassPoint, pts[i + 1]) < 0.05
          if (!duplicate) pts.splice(i + 1, 0, bypassPoint)
          if (!avoided.some((x) => x.id === s.id)) avoided.push(s)
          changed = true
          break
        }
      }
    }
  }

  return { waypoints: pts.map((p) => [p.lat, p.lng]), avoided }
}

/**
 * Detour a route around shoal areas that are too shallow for the boat.
 * Only hazards with charted depth < draft + clearance are treated as active.
 */
export function applyShoalAvoidance(waypoints, shoals, draftFt, clearanceFt = 2) {
  const active = shoals.filter((s) => s.minDepthFt < draftFt + clearanceFt)
  return insertHazardBypasses(waypoints, active, 0.25)
}

/**
 * Detour a route around headlands/peninsulas. Unlike shoals these are land,
 * not a depth hazard, so every headland is always active regardless of draft.
 */
export function applyLandAvoidance(waypoints, headlands) {
  return insertHazardBypasses(waypoints, headlands, 0.3)
}

/**
 * Plan the whole route: the course to steer, and what it was steered around.
 *
 * One entry point because the two halves have to agree. The bypass passes above
 * predate the coastline data and work by pushing a waypoint off a circle's
 * centre — which, run over a course the water search already made navigable,
 * cheerfully inserts a dog-leg straight across a headland the search had gone
 * round. So they only run when the search could not answer and the channel
 * graph had to carry the route instead.
 */
export function planRoute(start, dest, {
  spine = [], branches = [], headlands: landAreas = [], shoals = [], draftFt = 0, clearanceFt = 2,
} = {}) {
  const activeShoals = shoals.filter((s) => s.minDepthFt < draftFt + clearanceFt)
  const waypoints = buildRouteWaypoints(start, dest, spine, branches, landAreas, activeShoals)

  if (routeCameFromWaterSearch(waypoints)) {
    // Report the hazards the boat would have met on the straight line and does
    // not meet on the plotted one — the search steered around them, so the
    // sidebar can say so without a second pass re-deriving the course.
    const startApproach = start.approach || { lat: start.lat, lng: start.lng }
    const destApproach = dest.approach || { lat: dest.lat, lng: dest.lng }
    const avoided = activeShoals.filter((s) => {
      const { distance, t } = distanceFromRoute(
        s.lat, s.lng,
        startApproach.lat, startApproach.lng,
        destApproach.lat, destApproach.lng,
      )
      if (!(t > 0.02 && t < 0.98 && distance < s.radiusNM)) return false
      return !routePassesThrough(waypoints, s)
    })
    return { waypoints, shoalsAvoided: avoided, searched: true }
  }

  const { waypoints: landClear } = applyLandAvoidance(waypoints, landAreas)
  const { waypoints: final, avoided } = applyShoalAvoidance(landClear, shoals, draftFt, clearanceFt)
  return { waypoints: final, shoalsAvoided: avoided, searched: false }
}

// Does the plotted course still pass inside this hazard's circle?
function routePassesThrough(waypoints, hazard) {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const { distance } = distanceFromRoute(
      hazard.lat, hazard.lng,
      waypoints[i][0], waypoints[i][1],
      waypoints[i + 1][0], waypoints[i + 1][1],
    )
    if (distance < hazard.radiusNM) return true
  }
  return false
}

// buildRouteWaypoints tags the routes it checked against the coastline, so
// planRoute knows whether the bypass passes still have work to do. A flag on
// the array keeps the function's return type unchanged for its other callers.
function routeCameFromWaterSearch(waypoints) {
  return waypoints.searched === true
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
