import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

const floodZoneStyle = () => ({
  color: '#FF4444',
  weight: 1,
  fillColor: '#FF4444',
  fillOpacity: 0.35,
})

function MapView({ floodZones }) {
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
    </MapContainer>
  )
}

export default MapView
