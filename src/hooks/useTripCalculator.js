import { useState, useCallback } from 'react'
import { marinas, pointsOfInterest, noWakeZones, navigationSpine, shoalAreas } from '../data'
import {
  calcTripDetails, calcNoWakeDelay, calcRouteDistanceNM, buildRouteWaypoints,
  findNearbyPOIs, applyShoalAvoidance, findShoalCrossings,
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
    const { waypoints: routeWaypoints, avoided } = applyShoalAvoidance(baseWaypoints, shoalAreas, draft)
    const distanceNM = calcRouteDistanceNM(routeWaypoints)
    const noWakeResult = calcNoWakeDelay(routeWaypoints, noWakeZones, cruisingSpeed)
    const details = calcTripDetails(distanceNM, cruisingSpeed, fuelBurn, tankSize, noWakeResult.totalDelayHours)
    const nearbyPOIs = findNearbyPOIs(start, dest, pointsOfInterest, 5)
    const shoalWarnings = findShoalCrossings(routeWaypoints, shoalAreas, draft)

    // Check draft clearance at start and destination
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
      routeWaypoints,
      nearbyPOIs,
      draftWarnings,
      shoalsAvoided: avoided,
      shoalWarnings,
      edited: false,
    }

    setTripResult(result)
    return result
  }, [startId, destId, tankSize, cruisingSpeed, fuelBurn, draft])

  // Apply a transform to the current waypoints, then recompute all
  // route-derived stats (distance, time, fuel, no-wake, shallow warnings)
  const recalcFromEdit = useCallback((transform) => {
    setTripResult((prev) => {
      if (!prev) return prev
      const routeWaypoints = transform(prev.routeWaypoints)
      if (routeWaypoints === prev.routeWaypoints) return prev
      const distanceNM = calcRouteDistanceNM(routeWaypoints)
      const noWakeResult = calcNoWakeDelay(routeWaypoints, noWakeZones, cruisingSpeed)
      const details = calcTripDetails(distanceNM, cruisingSpeed, fuelBurn, tankSize, noWakeResult.totalDelayHours)
      const shoalWarnings = findShoalCrossings(routeWaypoints, shoalAreas, draft)
      return {
        ...prev,
        routeWaypoints,
        distanceNM: Math.round(distanceNM * 10) / 10,
        ...details,
        noWakeZones: noWakeResult.affectedZones,
        shoalWarnings,
        edited: true,
      }
    })
  }, [cruisingSpeed, fuelBurn, tankSize, draft])

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
    routeEditors: {
      move: (index, lat, lng) =>
        recalcFromEdit((wps) =>
          index > 0 && index < wps.length - 1
            ? wps.map((p, i) => (i === index ? [lat, lng] : p))
            : wps
        ),
      insert: (afterIndex, lat, lng) =>
        recalcFromEdit((wps) => {
          const next = wps.slice()
          next.splice(afterIndex + 1, 0, [lat, lng])
          return next
        }),
      remove: (index) =>
        recalcFromEdit((wps) =>
          index > 0 && index < wps.length - 1 && wps.length > 3
            ? wps.filter((_, i) => i !== index)
            : wps
        ),
    },
  }
}
