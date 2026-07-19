import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, LayersControl, useMap } from 'react-leaflet'
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

export default function TripMap({ marinas, tripResult, focusPOI }) {
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
              url="https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={1}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay name="OpenSeaMap (Buoys & Marks)">
            <TileLayer
              url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
              opacity={0.9}
              attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="NOAA ENCs (Depths & Channels)">
            <TileLayer
              url="https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/tile/{z}/{y}/{x}"
              opacity={0.7}
              attribution='NOAA ENC'
              maxZoom={18}
            />
          </LayersControl.Overlay>
        </LayersControl>

        <FitBounds tripResult={tripResult} />
        <FlyToPOI focusPOI={focusPOI} />

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
              color="#1B2A4A"
              weight={3}
              dashArray="10 6"
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
