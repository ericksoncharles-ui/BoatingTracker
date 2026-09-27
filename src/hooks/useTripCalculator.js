import { useState, useCallback, useEffect } from 'react'
import { marinas, pointsOfInterest, noWakeZones, closedWaters } from '../data'
import {
  calcTripDetails, calcNoWakeDelay, calcRouteDistanceNM, findNearbyPOIs, parseBoatInputs,
  KEEL_CLEARANCE_FT,
} from '../utils'
import { loadDepthGrid } from '../depthGrid'
import { planRoute } from '../router'

// A landmark is somewhere to stand off and look at, not somewhere to tie up:
// a route to Montauk Point Light ends off the point, not on the bluff.
const endOf = (place) => (place.kind === 'landmark' && place.approach ? place.approach : place)

// Shallow or unsurveyed water at a route's end shorter than this is the dock
// itself, a cell or two, and not worth a line in the summary.
const END_NOTE_NM = 0.05

/**
 * The stretches of a route off deep water, summed for each end: how far is in
 * water the survey shows shallower than the boat needs, how far in cells it has
 * as dry (a dock drawn on the quay, a dredged cut narrower than a cell), and
 * the least depth charted in the shallow part.
 */
function summarizeEnds(stretches) {
  const ends = {}
  for (const end of ['start', 'dest']) {
    const mine = stretches.filter((s) => s.end === end)
    const shallow = mine.filter((s) => s.kind === 'shallow')
    const shallowNM = shallow.reduce((sum, s) => sum + s.lengthNM, 0)
    const dryNM = mine.filter((s) => s.kind === 'dry').reduce((sum, s) => sum + s.lengthNM, 0)
    const least = shallow.reduce((low, s) => (!low || (s.least && s.least.minFt < low.minFt) ? s.least : low), null)
    if (shallowNM >= END_NOTE_NM || dryNM >= END_NOTE_NM) {
      ends[end] = { shallowNM: Math.round(shallowNM * 100) / 100, dryNM: Math.round(dryNM * 100) / 100, least }
    }
  }
  return ends
}

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
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState(null)

  const boat = parseBoatInputs({ tankSize, cruisingSpeed, fuelBurn, draft })

  // The depth grid is a megabyte and a half. Fetch it once a destination is
  // picked, so it is usually in hand by the time Plan Trip is pressed.
  useEffect(() => {
    if (destId) loadDepthGrid().catch(() => {})
  }, [destId])

  const calculateTrip = useCallback(async () => {
    const start = marinas.find((m) => m.id === startId)
    const dest = marinas.find((m) => m.id === destId)
    const { values, valid } = parseBoatInputs({ tankSize, cruisingSpeed, fuelBurn, draft })
    if (!start || !dest || start.id === dest.id || !valid) return null
    const draftFt = values.draft
    const minDepthFt = draftFt + KEEL_CLEARANCE_FT

    setPlanning(true)
    setPlanError(null)
    let route
    try {
      const grid = await loadDepthGrid()
      // Let the Planning state paint before the search takes the thread.
      await new Promise((resolve) => setTimeout(resolve, 0))
      route = planRoute(grid, endOf(start), endOf(dest), { minDepthFt, closed: closedWaters })
    } catch {
      setPlanning(false)
      setPlanError('The depth data could not be loaded. Check the connection and try again.')
      return null
    }
    setPlanning(false)
    if (!route) {
      setTripResult(null)
      setPlanError(`No way by water from ${start.name} to ${dest.name} for a ${draftFt} ft draft.`)
      return null
    }

    const routeWaypoints = route.waypoints
    const distanceNM = calcRouteDistanceNM(routeWaypoints)
    const noWakeResult = calcNoWakeDelay(routeWaypoints, noWakeZones, values.cruisingSpeed)
    const details = calcTripDetails(
      distanceNM, values.cruisingSpeed, values.fuelBurn, values.tankSize, noWakeResult.totalDelayHours,
    )
    const nearbyPOIs = findNearbyPOIs(routeWaypoints, pointsOfInterest, 5)

    // Measured against the same keel clearance the route is held to, so a boat
    // is never taken round a 5 ft shoal and then waved without a word into a
    // harbor with 5 ft at the entrance. Under the draft itself is the harder
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
      minDepthFt,
      ...details,
      noWakeZones: noWakeResult.affectedZones,
      nearbyPOIs,
      draftWarnings,
      depth: {
        heldToFt: route.heldToFt,
        leastDepth: route.leastDepth,
        ends: summarizeEnds(route.stretches),
      },
      routeStretches: route.stretches,
      routeWaypoints,
    }

    setTripResult(result)
    return result
  }, [startId, destId, tankSize, cruisingSpeed, fuelBurn, draft])

  const resetTrip = useCallback(() => {
    setTripResult(null)
    setPlanError(null)
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
    planning,
    planError,
    calculateTrip,
    resetTrip,
  }
}
