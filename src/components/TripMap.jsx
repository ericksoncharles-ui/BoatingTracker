import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, LayersControl, LayerGroup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGeolocation } from '../hooks/useGeolocation'

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

export default function TripMap({ marinas, shoalAreas }) {
  return (
    <div className="map-container">
      <MapContainer center={LI_SOUND_CENTER} zoom={LI_SOUND_ZOOM} className="leaflet-map">
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

        <LiveLocation />

        {marinas.map((marina) => (
          <Marker key={marina.id} position={[marina.lat, marina.lng]}>
            <Popup>{marina.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
