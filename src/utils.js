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

// What the boat inputs accept. Wide enough for a skiff or a sportfisherman,
// and a sailboat motoring on a 0 GPH guess; narrow enough that a slip of the
// thumb is caught before it reaches the arithmetic. A cleared speed field used
// to read as 0 kts and plan an "Infinityh NaNm" trip.
export const BOAT_LIMITS = {
  tankSize: { label: 'Tank', unit: 'gal', min: 1, max: 3000 },
  cruisingSpeed: { label: 'Speed', unit: 'kts', min: 1, max: 80 },
  fuelBurn: { label: 'Burn', unit: 'GPH', min: 0, max: 300 },
  draft: { label: 'Draft', unit: 'ft', min: 0, max: 20 },
}

/**
 * The boat inputs as numbers, and what is wrong with any that can't be used.
 * Takes the fields' own text, so a field emptied mid-edit reads as missing
 * rather than as zero.
 */
export function parseBoatInputs(fields) {
  const values = {}
  const errors = {}
  for (const [key, { label, unit, min, max }] of Object.entries(BOAT_LIMITS)) {
    const text = String(fields[key] ?? '').trim()
    const n = Number(text)
    if (text === '' || !Number.isFinite(n)) errors[key] = `${label} needs a number`
    else if (n < min || n > max) errors[key] = `${label} must be ${min} to ${max} ${unit}`
    else values[key] = n
  }
  return { values, errors, valid: Object.keys(errors).length === 0 }
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

// Water to keep under the keel, in feet at MLW. The router holds a route to
// the draft plus this (router.js), and the harbor-approach draft warning
// measures against it too, so a boat is never routed round a 5 ft shoal and
// then waved into a 5 ft harbor.
export const KEEL_CLEARANCE_FT = 2

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
