import { MapContainer, TileLayer, GeoJSON, Marker, useMapEvents } from 'react-leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

const floodZoneStyle = () => ({
  color: '#FF4444',
  weight: 1,
  fillColor: '#FF4444',
  fillOpacity: 0.35,
})

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function MapView({ floodZones, startPoint, endPoint, onMapClick }) {
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
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  )
}

export default MapView
