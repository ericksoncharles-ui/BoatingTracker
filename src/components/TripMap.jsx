import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, LayersControl, LayerGroup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGeolocation } from '../hooks/useGeolocation'
import { calcDistanceNM } from '../utils'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Switching away from a map tab unmounts the map, and if a zoom animation is
// mid-flight — the initial GPS recentre makes that a common moment to click
// Tides & Conditions — Leaflet's queued transition handler then dereferences
// the pane remove() already deleted and throws (leaflet/Leaflet#7722). Guard
// the handler so a destroyed map ignores its own leftover animation events.
const onZoomTransitionEnd = L.Map.prototype._onZoomTransitionEnd
L.Map.prototype._onZoomTransitionEnd = function (...args) {
  if (!this._mapPane) return
  return onZoomTransitionEnd.apply(this, args)
}

// Compass rose matching the sidebar/tab-bar mark, printed on the chart itself
// like a title block — the Nautical Chart tab has no sidebar to carry the brand.
const BRAND_ICON = (
  <svg viewBox="0 0 44 44" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="20" stroke="#90A4C4" strokeWidth="1.2" opacity="0.5"/>
    <circle cx="22" cy="22" r="17" stroke="#90A4C4" strokeWidth="0.6" opacity="0.3"/>
    <polygon points="22,2 25,18 22,16 19,18" fill="#C8D6E5" opacity="0.9"/>
    <polygon points="22,42 25,26 22,28 19,26" fill="#90A4C4" opacity="0.5"/>
    <polygon points="42,22 26,19 28,22 26,25" fill="#90A4C4" opacity="0.5"/>
    <polygon points="2,22 18,19 16,22 18,25" fill="#90A4C4" opacity="0.5"/>
    <polygon points="35.7,8.3 27,18 26,17 27,16" fill="#90A4C4" opacity="0.35"/>
    <polygon points="35.7,35.7 27,26 26,27 27,28" fill="#90A4C4" opacity="0.35"/>
    <polygon points="8.3,35.7 17,26 18,27 17,28" fill="#90A4C4" opacity="0.35"/>
    <polygon points="8.3,8.3 17,18 18,17 17,16" fill="#90A4C4" opacity="0.35"/>
    <circle cx="22" cy="22" r="2.5" fill="#1B2A4A" stroke="#C8D6E5" strokeWidth="1"/>
    <text x="22" y="10" textAnchor="middle" fill="#C8D6E5" fontSize="5" fontWeight="700" fontFamily="serif">N</text>
  </svg>
)

const LI_SOUND_CENTER = [41.05, -73.2]
const LI_SOUND_ZOOM = 10

// At zoom 10 the whole Sound fits but soundings, buoys and channel marks are
// unreadable, so open tighter: zoom 12 covers a harbor and its approaches,
// zoom 13 is close enough to pick out marks around the boat.
const HARBOR_ZOOM = 12
const GPS_ZOOM = 13

// A GPS fix farther than this from mid-Sound is off the chart we cover, so
// centering on it would just show blank tiles.
const IN_RANGE_NM = 120

// Recentering on the boat only happens when location is already granted — an
// unprompted permission dialog on load would ambush anyone just browsing.
function InitialView() {
  const map = useMap()

  useEffect(() => {
    let cancelled = false
    if (!('geolocation' in navigator) || !window.isSecureContext) return
    if (!navigator.permissions?.query) return

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return
            const { latitude, longitude } = pos.coords
            const offChart = calcDistanceNM(LI_SOUND_CENTER[0], LI_SOUND_CENTER[1], latitude, longitude) > IN_RANGE_NM
            if (offChart) return
            map.setView([latitude, longitude], Math.max(map.getZoom(), GPS_ZOOM))
          },
          () => {},
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [map])

  return null
}

function LiveLocation() {
  const map = useMap()
  const { position, error, tracking, start, stop } = useGeolocation({ watch: true })
  const hasCenteredRef = useRef(false)

  // Recentre on the first fix only — after that the skipper stays in control of
  // the viewport instead of being yanked back on every update.
  useEffect(() => {
    if (!position || hasCenteredRef.current) return
    hasCenteredRef.current = true
    map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 13), { duration: 1.2 })
  }, [position, map])

  // Whenever tracking ends — by the button or by a geolocation error — arm the
  // recentre again so the next fix flies to it.
  useEffect(() => {
    if (!tracking) hasCenteredRef.current = false
  }, [tracking])

  const startTracking = start
  const stopTracking = stop

  return (
    <>
      <div
        className="locate-control leaflet-bottom leaflet-right"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className={`locate-btn ${tracking ? 'locate-active' : ''}`}
          title={tracking ? 'Stop tracking location' : 'Show my location'}
          onClick={() => (tracking ? stopTracking() : startTracking())}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" fill={tracking ? 'currentColor' : 'none'} />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        </button>
        {error && <div className="locate-error">{error}</div>}
      </div>

      {position && (
        <>
          <Circle
            center={[position.lat, position.lng]}
            radius={position.accuracy}
            color="#2B6CB0"
            weight={1}
            fillColor="#2B6CB0"
            fillOpacity={0.12}
          />
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={8}
            fillColor="#2B6CB0"
            color="#FFFFFF"
            weight={3}
            fillOpacity={1}
          >
            <Popup>
              <strong>Your position</strong>
              <br />
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              {position.speedKts != null && (
                <>
                  <br />
                  Speed: {position.speedKts.toFixed(1)} kts
                </>
              )}
              <br />
              Accuracy: ±{Math.round(position.accuracy)} m
            </Popup>
          </CircleMarker>
        </>
      )}
    </>
  )
}

export default function TripMap({ marinas, shoalAreas, focus }) {
  const center = focus ? [focus.lat, focus.lng] : LI_SOUND_CENTER
  const zoom = focus ? HARBOR_ZOOM : LI_SOUND_ZOOM

  return (
    <div className="map-container">
      <MapContainer center={center} zoom={zoom} className="leaflet-map">
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Street Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer checked name="NOAA Nautical Chart">
            <TileLayer
              attribution='NOAA Office of Coast Survey'
              url="https://gis.charttools.noaa.gov/arcgis/rest/services/MarineChart_Services/NOAACharts/MapServer/tile/{z}/{y}/{x}"
              zoomOffset={-2}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Ocean Chart (Bathymetry)">
            <TileLayer
              attribution='&copy; Esri &mdash; Sources: GEBCO, NOAA, National Geographic, Garmin'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={13}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="OpenSeaMap (Buoys & Marks)">
            <TileLayer
              url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
              opacity={0.9}
              attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
            />
          </LayersControl.Overlay>

          {shoalAreas && (
            <LayersControl.Overlay checked name="Shoals & Hazards">
              <LayerGroup>
                {shoalAreas.map((s) => {
                  const color = s.minDepthFt <= 3 ? '#C53030' : s.minDepthFt <= 6 ? '#DD6B20' : '#D69E2E'
                  return (
                    <Circle
                      key={s.id}
                      center={[s.lat, s.lng]}
                      radius={s.radiusNM * 1852}
                      color={color}
                      weight={1.5}
                      dashArray="4 4"
                      fillColor={color}
                      fillOpacity={0.08}
                    >
                      <Popup>
                        <strong>{s.name}</strong>
                        <br />
                        Min depth: {s.minDepthFt} ft (MLW)
                      </Popup>
                    </Circle>
                  )
                })}
              </LayerGroup>
            </LayersControl.Overlay>
          )}
        </LayersControl>

        <InitialView />
        <LiveLocation />

        {marinas.map((marina) => (
          <Marker key={marina.id} position={[marina.lat, marina.lng]}>
            <Popup>{marina.name}</Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Only shown on the standalone Nautical Chart tab (see .chart-layout
          .map-brand-plate) — the planner map has the sidebar for branding, and
          the mobile map has the floating .mobile-brand badge over every tab. */}
      <div className="map-brand-plate">
        {BRAND_ICON}
        <span>SoundCaptain</span>
      </div>
    </div>
  )
}
