import { MapContainer, TileLayer } from 'react-leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

function MapView() {
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
    </MapContainer>
  )
}

export default MapView
