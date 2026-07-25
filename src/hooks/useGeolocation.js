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

const PERMISSION_DENIED = 1
const TIMEOUT = 3

function messageForError(err) {
  if (err.code === PERMISSION_DENIED) return 'Location permission denied'
  if (err.code === TIMEOUT) return 'Location timed out — try moving to an open area'
  return 'Unable to get location'
}

// The first fix is attempted in passes rather than once.
//
// The cheap network locator usually answers in a second or two, but on desktop
// browsers it returns POSITION_UNAVAILABLE fairly often even with permission
// granted, where the OS locator behind enableHighAccuracy succeeds — which is
// why the chart could find the boat while the conditions screen could not. Each
// pass also accepts an older cached fix: tides and buoy distances barely move
// over a few minutes, so a stale position beats no position.
function attemptsFor(highAccuracy) {
  if (highAccuracy) {
    return [
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 30000 },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 15000 },
    ]
  }
  return [
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    { enableHighAccuracy: true, maximumAge: 120000, timeout: 20000 },
    { enableHighAccuracy: true, maximumAge: 600000, timeout: 30000 },
  ]
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
  // Bumped on every start/stop so callbacks from an abandoned run — a pass that
  // was still waiting when the user retried — can't write stale state.
  const runIdRef = useRef(0)
  const autoStartedRef = useRef(false)

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    runIdRef.current += 1
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

    runIdRef.current += 1
    const runId = runIdRef.current
    const isCurrent = () => runIdRef.current === runId

    clearWatch()
    setError(null)
    setTracking(true)

    const fail = (err) => {
      // Drop the last fix rather than leaving a stale marker behind that looks
      // live. Callers that need a position fall back to a known location.
      clearWatch()
      setTracking(false)
      setPosition(null)
      setError(messageForError(err))
    }

    const attempts = attemptsFor(highAccuracy)

    const attempt = (index) => {
      // iOS Safari/Chrome require getCurrentPosition first to reliably trigger
      // the permission prompt; watchPosition alone often silently fails.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isCurrent()) return
          setPosition(toPosition(pos))
          setError(null)
          if (!watch) {
            setTracking(false)
            return
          }
          watchIdRef.current = navigator.geolocation.watchPosition(
            (next) => {
              if (isCurrent()) setPosition(toPosition(next))
            },
            (err) => {
              if (isCurrent()) fail(err)
            },
            { enableHighAccuracy: highAccuracy, maximumAge: 5000, timeout: 30000 },
          )
        },
        (err) => {
          if (!isCurrent()) return
          // A refused permission is a decision, not a flaky locator — retrying
          // only burns time on a prompt the browser will not show again.
          if (err.code === PERMISSION_DENIED || index + 1 >= attempts.length) {
            fail(err)
            return
          }
          attempt(index + 1)
        },
        attempts[index],
      )
    }

    attempt(0)
  }, [watch, highAccuracy, clearWatch])

  useEffect(() => {
    // Only on mount: a re-run here would restart the ladder mid-flight.
    if (!autoStart || autoStartedRef.current) return
    autoStartedRef.current = true
    start()
  }, [autoStart, start])

  useEffect(
    () => () => {
      runIdRef.current += 1
      clearWatch()
    },
    [clearWatch],
  )

  return { position, error, tracking, start, stop }
}
