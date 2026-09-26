import { useState, useCallback } from 'react'
import {
  marinas, pointsOfInterest, noWakeZones, navigationSpine, navigationBranches,
  shoalAreas, headlands,
} from '../data'
import {
  calcTripDetails, calcNoWakeDelay, calcRouteDistanceNM, buildRouteWaypoints,
  findNearbyPOIs, applyShoalAvoidance, applyLandAvoidance, parseBoatInputs,
  KEEL_CLEARANCE_FT,
} from '../utils'
import { coastline } from '../coastline'

export function useTripCalculator() {
  const [startId, setStartId] = useState('stamford')
  const [destId, setDestId] = useState('')
  // The boat fields hold their text rather than a number, so one cleared to be
  // retyped stays empty instead of snapping to 0 under the cursor.
  const [tankSize, setTankSize] = useState('90')
  const [cruisingSpeed, setCruisingSpeed] = useState('22')
  const [fuelBurn, setFuelBurn] = useState('12')
  const [draft, setDraft] = useState('3')
  const [tripResult, setTripResult] = useState(null)

  const boat = parseBoatInputs({ tankSize, cruisingSpeed, fuelBurn, draft })

  const calculateTrip = useCallback(() => {
    const start = marinas.find((m) => m.id === startId)
    const dest = marinas.find((m) => m.id === destId)
    const { values, valid } = parseBoatInputs({ tankSize, cruisingSpeed, fuelBurn, draft })
    if (!start || !dest || start.id === dest.id || !valid) return null
    const draftFt = values.draft

    const baseWaypoints = buildRouteWaypoints(start, dest, navigationSpine, navigationBranches, headlands, coastline)
    const { waypoints: landClearWaypoints } = applyLandAvoidance(baseWaypoints, headlands)
    const { waypoints: routeWaypoints, avoided, unavoided } = applyShoalAvoidance(
      landClearWaypoints, shoalAreas, draftFt, { coast: coastline },
    )
    const distanceNM = calcRouteDistanceNM(routeWaypoints)
    const noWakeResult = calcNoWakeDelay(routeWaypoints, noWakeZones, values.cruisingSpeed)
    const details = calcTripDetails(
      distanceNM, values.cruisingSpeed, values.fuelBurn, values.tankSize, noWakeResult.totalDelayHours,
    )
    const nearbyPOIs = findNearbyPOIs(routeWaypoints, pointsOfInterest, 5)

    // Measured against the same keel clearance the shoal detours keep, so a
    // boat is never taken round a 5 ft shoal and then waved without a word into
    // a harbor with 5 ft at the entrance. Under the draft itself is the harder
    // warning: that one needs the tide, not just care.
    const draftWarnings = []
    if (draftFt > 0) {
      for (const [place, type] of [[start, 'departure'], [dest, 'destination']]) {
        const depth = place.approachDepthFt
        if (!depth) continue
        const underKeel = Math.round((depth - draftFt) * 10) / 10
        if (underKeel < KEEL_CLEARANCE_FT) {
          draftWarnings.push({ marina: place.name, depth, type, underKeel, aground: underKeel <= 0 })
        }
      }
    }

    const result = {
      start,
      dest,
      distanceNM: Math.round(distanceNM * 10) / 10,
      cruisingSpeed: values.cruisingSpeed,
      draft: draftFt,
      ...details,
      noWakeZones: noWakeResult.affectedZones,
      nearbyPOIs,
      draftWarnings,
      shoalsAvoided: avoided,
      shoalsUnavoided: unavoided,
      routeWaypoints,
    }

    setTripResult(result)
    return result
  }, [startId, destId, tankSize, cruisingSpeed, fuelBurn, draft])

  const resetTrip = useCallback(() => {
    setTripResult(null)
  }, [])

  return {
    startId, setStartId,
    destId, setDestId,
    tankSize, setTankSize,
    cruisingSpeed, setCruisingSpeed,
    fuelBurn, setFuelBurn,
    draft, setDraft,
    boatErrors: boat.errors,
    tripResult,
    calculateTrip,
    resetTrip,
  }
}
