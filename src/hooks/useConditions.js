import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBuoyConditions } from '../services/erddapBuoy'
import { fetchUconnSeaState } from '../services/uconnSeaState'
import { fetchTides } from '../services/noaaTides'
import { fetchForecast } from '../services/forecast'
import { fetchMarineAlerts } from '../services/nwsAlerts'

// Pulls the condition sources together for one position.
//
// Each section carries its own status so a single dead API degrades one card
// instead of blanking the screen, and the last good payload is cached so the
// panel still says something useful when the signal drops offshore.
//
// `uconn` and `buoy` are the same four buoys read two ways — off UConn's own
// pages via /api/sea-state, and off the ERDDAP mirrors of the national network.
// Both are fetched every refresh because either can be silent while the other
// reports, and the panel prefers whichever has waves.

const CACHE_PREFIX = 'bt.conditions.v1.'
const STALE_MS = 10 * 60 * 1000

const IDLE = { status: 'idle', data: null, error: null }
const SECTION_KEYS = ['tides', 'buoy', 'uconn', 'forecast', 'alerts']

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

// JSON has no date type, so ISO strings coming back out of the cache are turned
// back into Dates — the components format them as dates.
function reviveDates(_key, value) {
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return value
}

// Two decimal places is roughly a kilometre — close enough that cached
// conditions still apply, coarse enough to actually get cache hits.
function cacheKey(lat, lng) {
  return `${CACHE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)}`
}

function readCache(lat, lng) {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng))
    if (!raw) return null
    const cached = JSON.parse(raw, reviveDates)
    return cached?.savedAt ? cached : null
  } catch {
    return null
  }
}

function writeCache(lat, lng, sections) {
  try {
    const payload = { savedAt: Date.now() }
    for (const key of SECTION_KEYS) {
      // Only successful sections are worth restoring.
      if (sections[key]?.status === 'ok' || sections[key]?.status === 'empty') {
        payload[key] = sections[key]
      }
    }
    localStorage.setItem(cacheKey(lat, lng), JSON.stringify(payload))
  } catch {
    // A full or unavailable localStorage costs us the cache, nothing more.
  }
}

export function useConditions({ lat, lng, enabled = true }) {
  const [sections, setSections] = useState({
    tides: IDLE,
    buoy: IDLE,
    uconn: IDLE,
    forecast: IDLE,
    alerts: IDLE,
  })
  const [updatedAt, setUpdatedAt] = useState(null)
  const [cachedAt, setCachedAt] = useState(null)
  const [failedAt, setFailedAt] = useState(null)

  const abortRef = useRef(null)
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections

  const refresh = useCallback(async () => {
    if (!enabled || lat == null || lng == null) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    // Keep whatever is already on screen while refreshing, so the panel doesn't
    // flash empty on every poll.
    setSections((prev) => {
      const next = { ...prev }
      for (const key of SECTION_KEYS) next[key] = { ...prev[key], status: 'loading' }
      return next
    })

    const settle = (key, value) => {
      if (signal.aborted) return
      setSections((prev) => ({ ...prev, [key]: value }))
    }

    const track = (key, promise, toSection) =>
      promise.then(
        (data) => settle(key, toSection(data)),
        (err) => {
          if (err.name === 'AbortError') return
          settle(key, { status: 'error', data: null, error: err.message })
        },
      )

    await Promise.allSettled([
      track('tides', fetchTides({ lat, lng, signal }), (data) => ({
        status: 'ok',
        data,
        error: null,
      })),
      track('buoy', fetchBuoyConditions({ here: { lat, lng }, signal }), (data) => ({
        // The buoy reporting nothing is an ordinary outcome, not a failure.
        status: data.status === 'empty' ? 'empty' : 'ok',
        data,
        error: null,
      })),
      track('uconn', fetchUconnSeaState({ here: { lat, lng }, signal }), (data) => ({
        // 'off' is a server with no API key — the sea state simply comes from
        // the ERDDAP reader instead, which is not a failure of anything.
        status: data.status === 'off' ? 'off' : data.status === 'empty' ? 'empty' : 'ok',
        data: data.status === 'off' ? null : data,
        error: null,
      })),
      track('forecast', fetchForecast({ lat, lng, signal }), (data) => ({
        status: 'ok',
        data,
        error: null,
      })),
      track('alerts', fetchMarineAlerts({ lat, lng, signal }), (data) => ({
        status: 'ok',
        data,
        error: null,
      })),
    ])

    if (signal.aborted) return

    const current = sectionsRef.current
    // A section that is switched off (no API key behind it) never had a chance
    // to fail, so counting it would stop the panel from reporting a genuine
    // everything-is-down.
    const attempted = SECTION_KEYS.filter((key) => current[key].status !== 'off')
    const allFailed =
      attempted.length > 0 && attempted.every((key) => current[key].status === 'error')

    if (allFailed) {
      setFailedAt(Date.now())
    } else {
      setUpdatedAt(Date.now())
      setFailedAt(null)
      setCachedAt(null)
      writeCache(lat, lng, current)
    }
  }, [lat, lng, enabled])

  // Paint from cache immediately on a new position, then go get fresh data.
  useEffect(() => {
    if (!enabled || lat == null || lng == null) return
    const cached = readCache(lat, lng)
    if (cached) {
      setSections((prev) => {
        const next = { ...prev }
        for (const key of SECTION_KEYS) if (cached[key]) next[key] = cached[key]
        return next
      })
      setCachedAt(cached.savedAt)
    }
    refresh()
    return () => abortRef.current?.abort()
  }, [lat, lng, enabled, refresh])

  // Coming back to the app after a while should show current numbers, but there
  // is no reason to poll while it is in the background.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (updatedAt && Date.now() - updatedAt < STALE_MS) return
      refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh, updatedAt])

  const loading = SECTION_KEYS.some((key) => sections[key].status === 'loading')

  return {
    ...sections,
    loading,
    updatedAt,
    cachedAt,
    failedAt,
    stale: updatedAt != null && Date.now() - updatedAt > STALE_MS,
    refresh,
  }
}
