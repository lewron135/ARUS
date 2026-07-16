import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

const floodZoneStyle = () => ({
  color: '#FF4444',
  weight: 1,
  fillColor: '#FF4444',
  fillOpacity: 0.22,
})

const startIcon = divIcon({
  className: 'arus-point-icon',
  html: '<span class="arus-point-dot arus-point-dot--start"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const endIcon = divIcon({
  className: 'arus-point-icon',
  html: '<span class="arus-point-dot arus-point-dot--end"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function severityLabel(state) {
  if (state >= 3) return { level: 'CRITICAL', depth: '40-60cm' }
  if (state === 2) return { level: 'MODERATE', depth: '20-40cm' }
  return { level: 'LOW', depth: '10-20cm' }
}

function toLatLngs(lineGeometry) {
  return lineGeometry.coordinates.map(([lng, lat]) => [lat, lng])
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
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
  navigating = false,
}) {
  // findSafeRoute returns the SAME object reference as normalRoute when the
  // normal route never crossed a flood zone (no detour needed) — in that
  // case we draw only the teal line, not a redundant dashed-red one under it.
  const routeNeededDetour = normalRoute && safeRoute !== normalRoute
  const showNormalDashed = normalRoute && (routeNeededDetour || !safeRoute) && !navigating
  const showSafeTeal = Boolean(safeRoute)

  return (
    <MapContainer
      center={JAKARTA_CENTER}
      zoom={13}
      style={{ height: '100%', width: '100%', background: '#e5e9e6' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {floodZones &&
        floodZones.features.map((zone, i) => {
          const { level, depth } = severityLabel(zone.properties?.state ?? 1)
          return (
            <GeoJSON key={`${floodZones.features.length}-${i}`} data={zone} style={floodZoneStyle}>
              <Tooltip permanent direction="top" className="arus-flood-tooltip" offset={[0, -4]}>
                <span className="arus-flood-tooltip-inner">
                  LVL: {level}
                  <br />({depth})
                </span>
              </Tooltip>
            </GeoJSON>
          )
        })}
      {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon} />}
      {endPoint && <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon} />}
      {showNormalDashed && (
        <Polyline
          positions={toLatLngs(normalRoute)}
          pathOptions={{ color: '#FF4444', weight: 4, dashArray: '8, 8' }}
        />
      )}
      {showSafeTeal && (
        <Polyline
          positions={toLatLngs(safeRoute)}
          pathOptions={
            navigating
              ? { color: '#00E5A0', weight: 5, dashArray: '2, 10', lineCap: 'round' }
              : { color: '#00E5A0', weight: 5 }
          }
        />
      )}
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  )
}

export default MapView
