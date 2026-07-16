import { Fragment, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Circle, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import * as turf from '@turf/turf'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

// Outer ring first: each successive ring is smaller and more opaque, faking
// a radial gradient since Leaflet vector layers can't fill with a real one.
const RADAR_RINGS = [
  { scale: 1, opacity: 0.05 },
  { scale: 0.72, opacity: 0.1 },
  { scale: 0.46, opacity: 0.18 },
  { scale: 0.22, opacity: 0.3 },
]

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

const radarPingIcon = divIcon({
  className: 'arus-radar-ping-icon',
  html: '<span class="arus-radar-ping"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function severityLabel(state) {
  if (state >= 3) return { level: 'CRITICAL', depth: '40-60cm' }
  if (state === 2) return { level: 'MODERATE', depth: '20-40cm' }
  return { level: 'LOW', depth: '10-20cm' }
}

function zoneCenterAndRadius(zone) {
  const centroid = turf.centroid(zone)
  const [, , maxX, maxY] = turf.bbox(zone)
  const corner = turf.point([maxX, maxY])
  const radiusMeters = turf.distance(centroid, corner, { units: 'kilometers' }) * 1000
  const [lng, lat] = centroid.geometry.coordinates
  return { center: [lat, lng], radiusMeters }
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

function FitBounds({ startPoint, endPoint, normalRoute, safeRoute, topPadding, bottomPadding }) {
  const map = useMap()

  useEffect(() => {
    const points = []
    if (startPoint) points.push([startPoint.lat, startPoint.lng])
    if (endPoint) points.push([endPoint.lat, endPoint.lng])
    ;(safeRoute ?? normalRoute)?.coordinates.forEach(([lng, lat]) => points.push([lat, lng]))

    if (points.length === 0) return
    map.fitBounds(latLngBounds(points), {
      paddingTopLeft: [32, topPadding ?? 90],
      paddingBottomRight: [32, bottomPadding ?? 90],
    })
  }, [map, startPoint, endPoint, normalRoute, safeRoute, topPadding, bottomPadding])

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
  fitBoundsTopPadding,
  fitBoundsBottomPadding,
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
      zoomControl={false}
      style={{ height: '100%', width: '100%', background: '#e5e9e6' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {floodZones &&
        floodZones.features.map((zone, i) => {
          const { level, depth } = severityLabel(zone.properties?.state ?? 1)
          const { center, radiusMeters } = zoneCenterAndRadius(zone)
          return (
            <Fragment key={`${floodZones.features.length}-${i}`}>
              {RADAR_RINGS.map((ring) => (
                <Circle
                  key={ring.scale}
                  center={center}
                  radius={radiusMeters * ring.scale}
                  pathOptions={{ stroke: false, fillColor: '#FF4444', fillOpacity: ring.opacity }}
                />
              ))}
              <Marker position={center} icon={radarPingIcon} />
              <GeoJSON data={zone} style={{ stroke: false, fillOpacity: 0 }}>
                <Tooltip permanent direction="top" className="arus-flood-tooltip" offset={[0, -6]}>
                  <span className="arus-flood-tooltip-inner">
                    LVL: {level}
                    <br />({depth})
                  </span>
                </Tooltip>
              </GeoJSON>
            </Fragment>
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
      <FitBounds
        startPoint={startPoint}
        endPoint={endPoint}
        normalRoute={normalRoute}
        safeRoute={safeRoute}
        topPadding={fitBoundsTopPadding}
        bottomPadding={fitBoundsBottomPadding}
      />
    </MapContainer>
  )
}

export default MapView
