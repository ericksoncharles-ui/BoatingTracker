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
 * Find the index of the nearest spine waypoint to a given point.
 */
function nearestSpineIndex(lat, lng, spine) {
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < spine.length; i++) {
    const d = calcDistanceNM(lat, lng, spine[i].lat, spine[i].lng)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
}

/**
 * Build a realistic route through the navigation spine.
 * Path: marina → approach waypoint → spine segment → approach waypoint → marina
 */
export function buildRouteWaypoints(start, dest, spine) {
  const startApproach = start.approach || { lat: start.lat, lng: start.lng }
  const destApproach = dest.approach || { lat: dest.lat, lng: dest.lng }

  const startSpineIdx = nearestSpineIndex(startApproach.lat, startApproach.lng, spine)
  const destSpineIdx = nearestSpineIndex(destApproach.lat, destApproach.lng, spine)

  // Build spine segment between the two indices
  const spinePoints = []
  if (startSpineIdx <= destSpineIdx) {
    for (let i = startSpineIdx; i <= destSpineIdx; i++) {
      spinePoints.push([spine[i].lat, spine[i].lng])
    }
  } else {
    for (let i = startSpineIdx; i >= destSpineIdx; i--) {
      spinePoints.push([spine[i].lat, spine[i].lng])
    }
  }

  // Skip spine if both marinas share the same nearest spine point
  // (they're close together, just route approach-to-approach)
  const route = [[start.lat, start.lng]]
  route.push([startApproach.lat, startApproach.lng])

  if (startSpineIdx !== destSpineIdx) {
    route.push(...spinePoints)
  }

  route.push([destApproach.lat, destApproach.lng])
  route.push([dest.lat, dest.lng])

  return route
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
