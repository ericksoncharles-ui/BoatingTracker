import { useCallback, useEffect, useRef, useState } from 'react'

// Shared device-location plumbing.
//
// The map wants a continuous high-accuracy watch; the conditions screen wants one
// cheap position. Both go through here so the iOS handling below lives in exactly
// one place.

function toPosition(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading: pos.coords.heading,
    speedKts: pos.coords.speed != null ? pos.coords.speed * 1.94384 : null,
    at: pos.timestamp ? new Date(pos.timestamp) : new Date(),
  }
}

function messageForError(err) {
  if (err.code === 1) return 'Location permission denied'
  if (err.code === 3) return 'Location timed out — try moving to an open area'
  return 'Unable to get location'
}

/**
 * @param {object} options
 * @param {boolean} options.watch        keep watching after the first fix
 * @param {boolean} options.highAccuracy request GPS-grade accuracy
 * @param {boolean} options.autoStart    request a position on mount
 */
export function useGeolocation({ watch = false, highAccuracy = true, autoStart = false } = {}) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [tracking, setTracking] = useState(false)
  const watchIdRef = useRef(null)

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearWatch()
    setTracking(false)
    setPosition(null)
    setError(null)
  }, [clearWatch])

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported by this browser')
      return
    }
    if (!window.isSecureContext) {
      setError('Location requires HTTPS')
      return
    }
    setError(null)
    setTracking(true)

    const handleError = (err) => {
      // Drop the last fix rather than leaving a stale marker behind that looks
      // live. Callers that need a position fall back to a known location.
      clearWatch()
      setTracking(false)
      setPosition(null)
      setError(messageForError(err))
    }

    // iOS Safari/Chrome require getCurrentPosition first to reliably trigger the
    // permission prompt; watchPosition alone often silently fails.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(toPosition(pos))
        if (!watch) {
          setTracking(false)
          return
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          (next) => setPosition(toPosition(next)),
          handleError,
          { enableHighAccuracy: highAccuracy, maximumAge: 5000, timeout: 30000 },
        )
      },
      handleError,
      { enableHighAccuracy: highAccuracy, maximumAge: 10000, timeout: 30000 },
    )
  }, [watch, highAccuracy, clearWatch])

  useEffect(() => {
    if (autoStart) start()
  }, [autoStart, start])

  useEffect(() => () => clearWatch(), [clearWatch])

  return { position, error, tracking, start, stop }
}
