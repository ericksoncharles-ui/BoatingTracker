import { useState, useEffect } from 'react'

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
    ? ` — consider a stop near ${nearbyPOIs[0].name} along the way`
    : ''
  const fuelNote = needsFuelWarning
    ? `Keep an eye on fuel — you'll use about ${fuelPercentUsed}% of your tank, so consider a fuel stop.`
    : `Fuel looks comfortable at ${fuelPercentUsed}% of tank capacity.`
  return `Your trip from ${start.name} to ${dest.name} covers ${distanceNM} nautical miles ${watersPhrase(start, dest)}. At ${cruisingSpeed || tripResult.cruisingSpeed} knots, expect about ${travelTimeFormatted} of cruising${poiNote}. ${fuelNote}`
}

export default function TripBriefing({ tripResult }) {
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAI, setIsAI] = useState(false)

  useEffect(() => {
    if (!tripResult) {
      setBriefing('')
      return
    }

    const controller = new AbortController()
    setLoading(true)

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
        setIsAI(true)
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setBriefing(generateFallbackBriefing(tripResult))
        setIsAI(false)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => { controller.abort() }
  }, [tripResult])

  if (!tripResult || (!briefing && !loading)) return null

  return (
    <div className="trip-briefing">
      <h3>Trip Briefing {isAI && <span className="ai-badge">AI</span>}</h3>
      {loading ? (
        <p className="briefing-loading">Generating briefing...</p>
      ) : (
        <p className="briefing-text">{briefing}</p>
      )}
    </div>
  )
}
