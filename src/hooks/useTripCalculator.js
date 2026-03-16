import { useState, useCallback } from 'react'
import { marinas, pointsOfInterest } from '../data'
import { calcDistanceNM, calcTripDetails, findNearbyPOIs } from '../utils'

export function useTripCalculator() {
  const [startId, setStartId] = useState('')
  const [destId, setDestId] = useState('')
  const [tankSize, setTankSize] = useState(90)
  const [cruisingSpeed, setCruisingSpeed] = useState(22)
  const [fuelBurn, setFuelBurn] = useState(12)
  const [tripResult, setTripResult] = useState(null)

  const calculateTrip = useCallback(() => {
    const start = marinas.find((m) => m.id === startId)
    const dest = marinas.find((m) => m.id === destId)
    if (!start || !dest || start.id === dest.id) return null

    const distanceNM = calcDistanceNM(start.lat, start.lng, dest.lat, dest.lng)
    const details = calcTripDetails(distanceNM, cruisingSpeed, fuelBurn, tankSize)
    const nearbyPOIs = findNearbyPOIs(start, dest, pointsOfInterest, 5)

    const result = {
      start,
      dest,
      distanceNM: Math.round(distanceNM * 10) / 10,
      ...details,
      nearbyPOIs,
    }

    setTripResult(result)
    return result
  }, [startId, destId, tankSize, cruisingSpeed, fuelBurn])

  const resetTrip = useCallback(() => {
    setTripResult(null)
  }, [])

  return {
    startId, setStartId,
    destId, setDestId,
    tankSize, setTankSize,
    cruisingSpeed, setCruisingSpeed,
    fuelBurn, setFuelBurn,
    tripResult,
    calculateTrip,
    resetTrip,
  }
}
