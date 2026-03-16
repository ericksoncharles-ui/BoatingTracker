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
 * Calculate trip details from distance and boat parameters.
 */
export function calcTripDetails(distanceNM, speedKnots, fuelBurnGPH, tankGallons) {
  const travelTimeHours = distanceNM / speedKnots
  const hours = Math.floor(travelTimeHours)
  const minutes = Math.round((travelTimeHours - hours) * 60)
  const fuelUsed = travelTimeHours * fuelBurnGPH
  const fuelRemaining = tankGallons - fuelUsed
  const fuelPercentUsed = (fuelUsed / tankGallons) * 100

  return {
    travelTimeHours,
    travelTimeFormatted: `${hours}h ${minutes}m`,
    fuelUsed: Math.round(fuelUsed * 10) / 10,
    fuelRemaining: Math.round(fuelRemaining * 10) / 10,
    fuelPercentUsed: Math.round(fuelPercentUsed),
    needsFuelWarning: fuelPercentUsed > 70,
  }
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
