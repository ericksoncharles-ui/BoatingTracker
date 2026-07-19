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

/**
 * Build the most direct practical route between two marinas.
 *
 * The navigation spine marks safe open water down the middle of the Sound.
 * Rather than always riding the spine between the nearest snap points (which
 * produces dog-legs and overshoot), evaluate every spine entry/exit pair plus
 * the direct approach-to-approach line, and take whichever is shortest.
 * Cross-Sound hops are open water, so the direct line is valid whenever it
 * beats the spine path.
 */
export function buildRouteWaypoints(start, dest, spine) {
  const startApproach = start.approach || { lat: start.lat, lng: start.lng }
  const destApproach = dest.approach || { lat: dest.lat, lng: dest.lng }

  const dist = (a, b) => calcDistanceNM(a.lat, a.lng, b.lat, b.lng)

  // Cumulative along-spine distances for fast segment sums
  const cum = [0]
  for (let i = 1; i < spine.length; i++) {
    cum[i] = cum[i - 1] + dist(spine[i - 1], spine[i])
  }
  const spineDist = (i, j) => Math.abs(cum[j] - cum[i])

  // A straight segment is considered safe open water when every point along it
  // stays within CORRIDOR_NM of the spine (the Sound's deep mid-water channel).
  // Headlands like Eatons Neck lie farther from the spine than this. Points
  // within APPROACH_NM of either segment endpoint are exempt — endpoints are
  // curated approach waypoints, so the water immediately around them is known
  // navigable.
  const CORRIDOR_NM = 6
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
      let minDist = Infinity
      for (let i = 0; i < spine.length - 1; i++) {
        const { distance } = distanceFromRoute(
          p.lat, p.lng,
          spine[i].lat, spine[i].lng,
          spine[i + 1].lat, spine[i + 1].lng
        )
        if (distance < minDist) minDist = distance
      }
      if (minDist > CORRIDOR_NM) return false
    }
    return true
  }

  // Entry/exit is limited to the nearest couple of spine points — long diagonal
  // entry legs can cut across headlands (e.g. Eatons Neck), while the short
  // hop out to the nearest channel points is a safe approach corridor.
  const nearestIndices = (pt, count) =>
    spine
      .map((s, idx) => ({ idx, d: dist(pt, s) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((e) => e.idx)

  const entryCandidates = nearestIndices(startApproach, 2)
  const exitCandidates = nearestIndices(destApproach, 2)

  // Best route via the spine: enter at i, ride to j, exit
  let best = { length: Infinity, points: [] }
  for (const i of entryCandidates) {
    const entry = dist(startApproach, spine[i])
    for (const j of exitCandidates) {
      const length = entry + spineDist(i, j) + dist(spine[j], destApproach)
      if (length < best.length) {
        const points = []
        const step = i <= j ? 1 : -1
        for (let k = i; k !== j + step; k += step) {
          points.push([spine[k].lat, spine[k].lng])
        }
        best = { length, points }
      }
    }
  }

  // Direct open-water crossing beats the spine when it stays in the corridor.
  // Short hops (< 10 NM between curated approach points) always go direct —
  // nearby marinas on the same shore don't need the mid-Sound spine.
  const directDist = dist(startApproach, destApproach)
  if (directDist < best.length && (directDist < 10 || inCorridor(startApproach, destApproach))) {
    best = { length: directDist, points: [] }
  }

  // Greedy shortcut pass: skip ahead past intermediate points whenever the
  // straight chord stays inside the open-water corridor
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
      if (inCorridor(path[i], path[j])) {
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
 * Detour a route around shoal areas that are too shallow for the boat.
 * Any hazard with charted depth < draft + clearance gets a bypass waypoint
 * pushed just outside its radius, on the side the route already favors.
 * The first and last legs (marina to approach waypoint) are left alone —
 * those are curated harbor approaches.
 */
export function applyShoalAvoidance(waypoints, shoals, draftFt, clearanceFt = 2) {
  const active = shoals.filter((s) => s.minDepthFt < draftFt + clearanceFt)
  const buffer = 0.25
  const pts = waypoints.map(([lat, lng]) => ({ lat, lng }))
  const avoided = []

  let changed = true
  let iter = 0
  while (changed && iter++ < 6) {
    changed = false
    for (let i = 1; i < pts.length - 2 && !changed; i++) {
      for (const s of active) {
        const { distance, t } = distanceFromRoute(
          s.lat, s.lng,
          pts[i].lat, pts[i].lng,
          pts[i + 1].lat, pts[i + 1].lng
        )
        if (t > 0.02 && t < 0.98 && distance < s.radiusNM + buffer) {
          const cLat = pts[i].lat + t * (pts[i + 1].lat - pts[i].lat)
          const cLng = pts[i].lng + t * (pts[i + 1].lng - pts[i].lng)
          const cosLat = Math.cos((s.lat * Math.PI) / 180)
          // Direction from shoal center toward the route, in NM space
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
          pts.splice(i + 1, 0, {
            lat: s.lat + ((vLat / len) * targetNM) / 60,
            lng: s.lng + ((vLng / len) * targetNM) / (60 * cosLat),
          })
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
 * Find shoals a route actually crosses given the boat's draft — used to warn
 * on hand-edited routes. Marina/approach legs at the ends are exempt.
 */
export function findShoalCrossings(waypoints, shoals, draftFt, clearanceFt = 2) {
  const active = shoals.filter((s) => s.minDepthFt < draftFt + clearanceFt)
  const crossings = []
  for (const s of active) {
    for (let i = 1; i < waypoints.length - 2; i++) {
      const { distance, t } = distanceFromRoute(
        s.lat, s.lng,
        waypoints[i][0], waypoints[i][1],
        waypoints[i + 1][0], waypoints[i + 1][1]
      )
      if (t > 0.02 && t < 0.98 && distance < s.radiusNM) {
        crossings.push(s)
        break
      }
    }
  }
  return crossings
}

/**
 * Find POIs near the route, sorted by distance to the route midpoint.
 */
export function findNearbyPOIs(start, end, allPOIs, maxCount = 5) {
  const midLat = (start.lat + end.lat) / 2
  const midLng = (start.lng + end.lng) / 2

  const withDistance = allPOIs.map((poi) => ({
    ...poi,
    distFromRoute: calcDistanceNM(midLat, midLng, poi.lat, poi.lng),
  }))

  return withDistance.sort((a, b) => a.distFromRoute - b.distFromRoute).slice(0, maxCount)
}
