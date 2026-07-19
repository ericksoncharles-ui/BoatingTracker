import { useState, useEffect, useRef, useCallback } from 'react'

export default function LiveNavigation() {
  const [tracking, setTracking] = useState(false)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const watchIdRef = useRef(null)
  const prevPositionRef = useRef(null)
  const prevTimeRef = useRef(null)

  const computeHeadingFromMovement = useCallback((prev, curr) => {
    const dLng = (curr.lng - prev.lng) * Math.cos((curr.lat * Math.PI) / 180)
    const dLat = curr.lat - prev.lat
    const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI
    return (angle + 360) % 360
  }, [])

  const updatePosition = useCallback((pos) => {
    const now = Date.now()
    const curr = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speedKts: pos.coords.speed != null ? pos.coords.speed * 1.94384 : null,
      timestamp: now,
    }

    if (curr.heading == null && prevPositionRef.current && prevTimeRef.current) {
      const elapsed = (now - prevTimeRef.current) / 1000
      if (elapsed > 0 && elapsed < 30) {
        curr.heading = computeHeadingFromMovement(prevPositionRef.current, curr)
      }
    }

    if (curr.speedKts != null && curr.speedKts > maxSpeed) {
      setMaxSpeed(curr.speedKts)
    }

    prevPositionRef.current = curr
    prevTimeRef.current = now
    setPosition(curr)
  }, [maxSpeed, computeHeadingFromMovement])

  const handleError = useCallback((err) => {
    if (err.code === 1) setError('Location permission denied')
    else if (err.code === 3) setError('Location timed out — move to open area')
    else setError('Unable to get location')
    stopTracking()
  }, [])

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
    setPosition(null)
    setError(null)
    setMaxSpeed(0)
    prevPositionRef.current = null
    prevTimeRef.current = null
  }

  const startTracking = () => {
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePosition(pos)
        watchIdRef.current = navigator.geolocation.watchPosition(
          updatePosition,
          handleError,
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
        )
      },
      handleError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    )
  }

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
  }, [])

  const formatCoord = (val, isLat) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W')
    const abs = Math.abs(val)
    const deg = Math.floor(abs)
    const min = ((abs - deg) * 60).toFixed(3)
    return `${deg}° ${min}' ${dir}`
  }

  const headingToCompass = (h) => {
    if (h == null) return '--'
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    return dirs[Math.round(h / 22.5) % 16]
  }

  if (!tracking) {
    return (
      <div className="nav-view">
        <div className="nav-idle">
          <div className="nav-idle-icon">
            <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 19 21 12 17 5 21" />
            </svg>
          </div>
          <h2>Live Navigation</h2>
          <p>Start tracking to see real-time heading, speed, and position data.</p>
          <button className="nav-start-btn" onClick={startTracking}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="8" />
            </svg>
            Start Navigation
          </button>
          {error && <div className="nav-error">{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="nav-view">
      <div className="nav-header">
        <button className="nav-stop-btn" onClick={stopTracking}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          Stop
        </button>
        <div className="nav-signal">
          <span className={`signal-dot ${position ? 'signal-active' : ''}`} />
          {position ? 'GPS Active' : 'Acquiring...'}
        </div>
      </div>

      <div className="nav-compass-section">
        <div className="nav-compass">
          <svg viewBox="0 0 200 200" className="compass-ring">
            <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(43,108,176,0.2)" strokeWidth="2" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="100"
                y1="10"
                x2="100"
                y2={deg % 90 === 0 ? 22 : 18}
                stroke="rgba(43,108,176,0.5)"
                strokeWidth={deg % 90 === 0 ? 2 : 1}
                transform={`rotate(${deg} 100 100)`}
              />
            ))}
            {['N', 'E', 'S', 'W'].map((label, i) => (
              <text
                key={label}
                x="100"
                y="32"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={label === 'N' ? '#C53030' : 'rgba(43,108,176,0.7)'}
                transform={`rotate(${i * 90} 100 100)`}
              >
                {label}
              </text>
            ))}
          </svg>
          <div
            className="compass-arrow-container"
            style={{ transform: `rotate(${position?.heading ?? 0}deg)` }}
          >
            <svg viewBox="0 0 100 100" className="compass-arrow">
              <polygon
                points="50,8 40,65 50,58 60,65"
                fill="var(--sea)"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
              />
              <polygon
                points="50,92 40,65 50,58 60,65"
                fill="rgba(43,108,176,0.3)"
              />
            </svg>
          </div>
        </div>

        <div className="nav-heading-display">
          <span className="heading-value">
            {position?.heading != null ? Math.round(position.heading) : '--'}
          </span>
          <span className="heading-unit">°</span>
          <span className="heading-cardinal">{headingToCompass(position?.heading)}</span>
        </div>
      </div>

      <div className="nav-speed-section">
        <div className="nav-speed-main">
          <span className="speed-value">
            {position?.speedKts != null ? position.speedKts.toFixed(1) : '0.0'}
          </span>
          <span className="speed-unit">kts</span>
        </div>
        <div className="nav-speed-sub">
          <div className="speed-secondary">
            <span className="speed-label">mph</span>
            <span className="speed-num">
              {position?.speedKts != null ? (position.speedKts * 1.15078).toFixed(1) : '0.0'}
            </span>
          </div>
          <div className="speed-secondary">
            <span className="speed-label">max</span>
            <span className="speed-num">{maxSpeed.toFixed(1)} kts</span>
          </div>
        </div>
      </div>

      <div className="nav-data-grid">
        <div className="nav-data-item">
          <span className="nav-data-label">LAT</span>
          <span className="nav-data-value">
            {position ? formatCoord(position.lat, true) : '--'}
          </span>
        </div>
        <div className="nav-data-item">
          <span className="nav-data-label">LON</span>
          <span className="nav-data-value">
            {position ? formatCoord(position.lng, false) : '--'}
          </span>
        </div>
        <div className="nav-data-item">
          <span className="nav-data-label">ACCURACY</span>
          <span className="nav-data-value">
            {position ? `±${Math.round(position.accuracy)} m` : '--'}
          </span>
        </div>
      </div>

      {error && <div className="nav-error">{error}</div>}
    </div>
  )
}
