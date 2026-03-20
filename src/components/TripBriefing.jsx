import { useState, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'

function generateFallbackBriefing(tripResult) {
  const { start, dest, distanceNM, travelTimeFormatted, cruisingSpeed, fuelPercentUsed, nearbyPOIs, needsFuelWarning } = tripResult
  const poiName = nearbyPOIs.length > 0 ? nearbyPOIs[0].name : 'the scenic waters'
  const fuelNote = needsFuelWarning
    ? `Keep an eye on fuel — you'll use about ${fuelPercentUsed}% of your tank, so consider a fuel stop.`
    : `Fuel looks comfortable at ${fuelPercentUsed}% of tank capacity.`
  return `Your trip from ${start.name} to ${dest.name} covers ${distanceNM} nautical miles across Long Island Sound. At ${cruisingSpeed || tripResult.cruisingSpeed} knots, expect about ${travelTimeFormatted} of cruising — consider a stop near ${poiName} along the way. ${fuelNote}`
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

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setBriefing(generateFallbackBriefing(tripResult))
      setIsAI(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const poiNames = tripResult.nearbyPOIs.map((p) => p.name).join(', ')
    const prompt = `You are a friendly harbor master. Give a 2-3 sentence trip briefing for a boating trip from ${tripResult.start.name} to ${tripResult.dest.name}, ${tripResult.distanceNM} nautical miles across Long Island Sound. Travel time is about ${tripResult.travelTimeFormatted} at cruising speed. Fuel usage is ${tripResult.fuelPercentUsed}% of tank. Nearby points of interest: ${poiNames}. Recommend one anchorage, mention fuel confidence, and keep it nautical and friendly.`

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

    client.messages
      .create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      })
      .then((response) => {
        if (!cancelled) {
          const text = response.content[0]?.text || ''
          setBriefing(text)
          setIsAI(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBriefing(generateFallbackBriefing(tripResult))
          setIsAI(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
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
