import { useCallback, useEffect, useRef, useState } from 'react'

// A trip that starts and ends in the same water is "across" it; one that doesn't
// is a run between two. Naming them beats the old hardcoded "across Long Island
// Sound", which was wrong the moment the list reached Nantucket.
function watersPhrase(start, dest) {
  if (!start.region || !dest.region) return 'across Long Island Sound'
  return start.region === dest.region
    ? `across ${start.region}`
    : `from ${start.region} to ${dest.region}`
}

function generateFallbackBriefing(tripResult) {
  const { start, dest, distanceNM, travelTimeFormatted, cruisingSpeed, fuelPercentUsed, nearbyPOIs, needsFuelWarning } = tripResult
  const poiNote = nearbyPOIs.length > 0
    ? ` ${nearbyPOIs[0].name} lies near the route.`
    : ''
  const fuelNote = needsFuelWarning
    ? `Projected fuel usage is ${fuelPercentUsed}% of tank capacity — plan a fuel stop.`
    : `Projected fuel usage is ${fuelPercentUsed}% of tank capacity.`
  return `Passage from ${start.name} to ${dest.name}: ${distanceNM} nautical miles ${watersPhrase(start, dest)}. Estimated transit time is ${travelTimeFormatted} at ${cruisingSpeed || tripResult.cruisingSpeed} knots cruising speed.${poiNote} ${fuelNote}`
}

const BUTTON_LABEL = {
  idle: 'Generate AI briefing',
  loading: 'Generating…',
  ok: 'Regenerate',
  error: 'Try again',
}

export default function TripBriefing({ tripResult }) {
  // The template briefing is free and instant, so it's what shows the moment
  // a trip loads. The AI rewrite costs a call, so — same rule as the fishing
  // report — it only happens when the boater asks for it.
  const [status, setStatus] = useState('idle')
  const [briefing, setBriefing] = useState('')
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    abortRef.current?.abort()
    if (!tripResult) {
      setBriefing('')
      setStatus('idle')
      return
    }
    setBriefing(generateFallbackBriefing(tripResult))
    setStatus('idle')
  }, [tripResult])

  const run = useCallback(() => {
    if (!tripResult) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')

    fetch('/api/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        startName: tripResult.start.name,
        destName: tripResult.dest.name,
        distanceNM: tripResult.distanceNM,
        travelTimeFormatted: tripResult.travelTimeFormatted,
        cruisingSpeed: tripResult.cruisingSpeed,
        startRegion: tripResult.start.region,
        destRegion: tripResult.dest.region,
        fuelPercentUsed: tripResult.fuelPercentUsed,
        nearbyPOIs: tripResult.nearbyPOIs.map((p) => p.name),
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Briefing request failed: ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!data.briefing) throw new Error('Empty briefing')
        setBriefing(data.briefing)
        setStatus('ok')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setBriefing(generateFallbackBriefing(tripResult))
        setStatus('error')
      })
  }, [tripResult])

  if (!tripResult) return null

  return (
    <div className="trip-briefing">
      <div className="trip-briefing-head">
        <h3>Trip Briefing {status === 'ok' && <span className="ai-badge">AI</span>}</h3>
        <div className="fishing-summary-actions">
          <button
            className="fishing-summary-run"
            onClick={run}
            disabled={status === 'loading'}
            type="button"
          >
            {BUTTON_LABEL[status]}
          </button>
        </div>
      </div>
      {status === 'loading' ? (
        <p className="briefing-loading">Generating briefing...</p>
      ) : (
        <p className="briefing-text">{briefing}</p>
      )}
    </div>
  )
}
