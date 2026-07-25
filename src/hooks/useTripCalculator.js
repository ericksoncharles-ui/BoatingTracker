import { useState, useCallback } from 'react'
import { marinas, pointsOfInterest, noWakeZones, navigationSpine, shoalAreas, headlands } from '../data'
import {
  calcTripDetails, calcNoWakeDelay, calcRouteDistanceNM, buildRouteWaypoints,
  findNearbyPOIs, applyShoalAvoidance, applyLandAvoidance,
} from '../utils'

export function useTripCalculator() {
  const [startId, setStartId] = useState('stamford')
  const [destId, setDestId] = useState('')
  const [tankSize, setTankSize] = useState(90)
  const [cruisingSpeed, setCruisingSpeed] = useState(22)
  const [fuelBurn, setFuelBurn] = useState(12)
  const [draft, setDraft] = useState(3)
  const [tripResult, setTripResult] = useState(null)

  const calculateTrip = useCallback(() => {
    const start = marinas.find((m) => m.id === startId)
    const dest = marinas.find((m) => m.id === destId)
    if (!start || !dest || start.id === dest.id) return null

    const baseWaypoints = buildRouteWaypoints(start, dest, navigationSpine)
    const { waypoints: landClearWaypoints } = applyLandAvoidance(baseWaypoints, headlands)
    const { waypoints: routeWaypoints, avoided } = applyShoalAvoidance(landClearWaypoints, shoalAreas, draft)
    const distanceNM = calcRouteDistanceNM(routeWaypoints)
    const noWakeResult = calcNoWakeDelay(routeWaypoints, noWakeZones, cruisingSpeed)
    const details = calcTripDetails(distanceNM, cruisingSpeed, fuelBurn, tankSize, noWakeResult.totalDelayHours)
    const nearbyPOIs = findNearbyPOIs(start, dest, pointsOfInterest, 5)

    const draftWarnings = []
    if (draft > 0) {
      if (start.approachDepthFt && draft >= start.approachDepthFt) {
        draftWarnings.push({ marina: start.name, depth: start.approachDepthFt, type: 'departure' })
      }
      if (dest.approachDepthFt && draft >= dest.approachDepthFt) {
        draftWarnings.push({ marina: dest.name, depth: dest.approachDepthFt, type: 'destination' })
      }
    }

    const result = {
      start,
      dest,
      distanceNM: Math.round(distanceNM * 10) / 10,
      cruisingSpeed,
      draft,
      ...details,
      noWakeZones: noWakeResult.affectedZones,
      nearbyPOIs,
      draftWarnings,
      shoalsAvoided: avoided,
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
    tripResult,
    calculateTrip,
    resetTrip,
  }
}
