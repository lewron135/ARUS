import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, useMapEvents } from 'react-leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

const floodZoneStyle = () => ({
  color: '#FF4444',
  weight: 1,
  fillColor: '#FF4444',
  fillOpacity: 0.35,
})

function toLatLngs(lineGeometry) {
  return lineGeometry.coordinates.map(([lng, lat]) => [lat, lng])
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function MapView({
  floodZones,
  startPoint,
  endPoint,
  onMapClick,
  normalRoute,
  safeRoute,
}) {
  // findSafeRoute returns the SAME object reference as normalRoute when the
  // normal route never crossed a flood zone (no detour needed) — in that
  // case we draw only the teal line, not a redundant dashed-red one under it.
  const routeNeededDetour = normalRoute && safeRoute !== normalRoute
  const showNormalDashed = normalRoute && (routeNeededDetour || !safeRoute)
  const showSafeTeal = Boolean(safeRoute)

  return (
    <MapContainer
      center={JAKARTA_CENTER}
      zoom={13}
      style={{ height: '100%', width: '100%', background: '#1a1209' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {floodZones && (
        <GeoJSON
          key={floodZones.features.length}
          data={floodZones}
          style={floodZoneStyle}
        />
      )}
      {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} />}
      {endPoint && <Marker position={[endPoint.lat, endPoint.lng]} />}
      {showNormalDashed && (
        <Polyline
          positions={toLatLngs(normalRoute)}
          pathOptions={{ color: '#FF4444', weight: 4, dashArray: '8, 8' }}
        />
      )}
      {showSafeTeal && (
        <Polyline
          positions={toLatLngs(safeRoute)}
          pathOptions={{ color: '#00E5A0', weight: 4 }}
        />
      )}
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  )
}

export default MapView
