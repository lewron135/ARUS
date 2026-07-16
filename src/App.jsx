import { useEffect, useState } from 'react'
import './App.css'
import MapView from './components/MapView.jsx'
import { getFloodZones } from './api/floodApi.js'

function App() {
  const [floodZones, setFloodZones] = useState(null)

  useEffect(() => {
    getFloodZones().then(setFloodZones)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>ARUS</h1>
        <span className="tagline">Flood-aware pedestrian routes for Jakarta</span>
      </header>
      <div className="map-area">
        <MapView floodZones={floodZones} />
      </div>
    </div>
  )
}

export default App
