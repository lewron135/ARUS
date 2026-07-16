import { useEffect, useState } from 'react'
import './App.css'
import MapView from './components/MapView.jsx'
import { getFloodZones } from './api/floodApi.js'

function App() {
  const [floodZones, setFloodZones] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)

  useEffect(() => {
    getFloodZones().then(setFloodZones)
  }, [])

  function handleMapClick(point) {
    if (!startPoint) {
      setStartPoint(point)
    } else if (!endPoint) {
      setEndPoint(point)
    } else {
      setStartPoint(point)
      setEndPoint(null)
    }
  }

  function handleReset() {
    setStartPoint(null)
    setEndPoint(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ARUS</h1>
        <span className="tagline">Flood-aware pedestrian routes for Jakarta</span>
      </header>
      <div className="control-bar">
        <span className="control-hint">
          {!startPoint && 'Click the map to set your start point'}
          {startPoint && !endPoint && 'Click the map to set your destination'}
          {startPoint && endPoint && 'Ready to find your route'}
        </span>
        <button type="button" disabled={!startPoint || !endPoint}>
          Find Route
        </button>
        {(startPoint || endPoint) && (
          <button type="button" className="reset-button" onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
      <div className="map-area">
        <MapView
          floodZones={floodZones}
          startPoint={startPoint}
          endPoint={endPoint}
          onMapClick={handleMapClick}
        />
      </div>
    </div>
  )
}

export default App
