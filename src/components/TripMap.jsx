import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, LayersControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const LI_SOUND_CENTER = [41.05, -73.2]
const LI_SOUND_ZOOM = 10

function FitBounds({ tripResult }) {
  const map = useMap()

  useEffect(() => {
    if (tripResult) {
      const bounds = L.latLngBounds(
        [tripResult.start.lat, tripResult.start.lng],
        [tripResult.dest.lat, tripResult.dest.lng]
      )
      tripResult.nearbyPOIs.forEach((poi) => {
        bounds.extend([poi.lat, poi.lng])
      })
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [tripResult, map])

  return null
}

function FlyToPOI({ focusPOI }) {
  const map = useMap()

  useEffect(() => {
    if (focusPOI) {
      map.flyTo([focusPOI.lat, focusPOI.lng], 13, { duration: 1.2 })
    }
  }, [focusPOI, map])

  return null
}

function LiveLocation() {
  const map = useMap()
  const [tracking, setTracking] = useState(false)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const watchIdRef = useRef(null)
  const hasCenteredRef = useRef(false)

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    hasCenteredRef.current = false
    setTracking(false)
    setPosition(null)
    setError(null)
  }

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported by this browser')
      return
    }
    setError(null)
    setTracking(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speedKts: pos.coords.speed != null ? pos.coords.speed * 1.94384 : null,
        }
        setPosition(next)
        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true
          map.flyTo([next.lat, next.lng], Math.max(map.getZoom(), 13), { duration: 1.2 })
        }
      },
      (err) => {
        setError(err.code === 1 ? 'Location permission denied' : 'Unable to get location')
        stopTracking()
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
  }, [])

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

const startIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'marker-start',
})

const destIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'marker-dest',
})

export default function TripMap({ marinas, tripResult, focusPOI, fullscreen }) {
  return (
    <div className={`map-container ${fullscreen ? 'map-fullscreen' : ''}`}>
      <MapContainer center={LI_SOUND_CENTER} zoom={LI_SOUND_ZOOM} className="leaflet-map" key={fullscreen ? 'chart' : 'planner'}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Street Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer checked name="Ocean Chart (Bathymetry)">
            <TileLayer
              attribution='&copy; Esri &mdash; Sources: GEBCO, NOAA, National Geographic, Garmin'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={13}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="NOAA Chart (experimental)">
            <TileLayer
              attribution='NOAA Office of Coast Survey'
              url="https://gis.charttools.noaa.gov/arcgis/rest/services/MarineChart_Services/NOAACharts/MapServer/tile/{z}/{y}/{x}"
              zoomOffset={-2}
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
        </LayersControl>

        <FitBounds tripResult={tripResult} />
        <FlyToPOI focusPOI={focusPOI} />
        <LiveLocation />

        {/* Marina markers */}
        {marinas.map((marina) => (
          <Marker key={marina.id} position={[marina.lat, marina.lng]}>
            <Popup>{marina.name}</Popup>
          </Marker>
        ))}

        {/* Trip route and POIs */}
        {tripResult && (
          <>
            <Marker position={[tripResult.start.lat, tripResult.start.lng]} icon={startIcon}>
              <Popup><strong>Start:</strong> {tripResult.start.name}</Popup>
            </Marker>
            <Marker position={[tripResult.dest.lat, tripResult.dest.lng]} icon={destIcon}>
              <Popup><strong>Destination:</strong> {tripResult.dest.name}</Popup>
            </Marker>
            <Polyline
              positions={tripResult.routeWaypoints}
              color="#E53E3E"
              weight={4}
              opacity={0.85}
            />
            <Polyline
              positions={tripResult.routeWaypoints}
              color="#FFFFFF"
              weight={6}
              opacity={0.4}
            />
            {tripResult.nearbyPOIs.map((poi) => (
              <CircleMarker
                key={poi.id}
                center={[poi.lat, poi.lng]}
                radius={8}
                fillColor="#D69E2E"
                color="#1B2A4A"
                weight={2}
                fillOpacity={0.8}
              >
                <Popup>
                  <strong>{poi.name}</strong>
                  <br />
                  {poi.description}
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>
    </div>
  )
}
