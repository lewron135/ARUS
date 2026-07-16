import { useEffect, useState } from 'react'
import './App.css'
import MapView from './components/MapView.jsx'
import { getFloodZones } from './api/floodApi.js'
import { getRoute } from './api/routeApi.js'

function App() {
  const [floodZones, setFloodZones] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)
  const [normalRoute, setNormalRoute] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)

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
    setNormalRoute(null)
    setRouteError(null)
  }

  function handleReset() {
    setStartPoint(null)
    setEndPoint(null)
    setNormalRoute(null)
    setRouteError(null)
  }

  async function handleFindRoute() {
    setIsLoading(true)
    setRouteError(null)
    try {
      const route = await getRoute([startPoint, endPoint])
      setNormalRoute(route)
    } catch (err) {
      setRouteError(err.message)
    } finally {
      setIsLoading(false)
    }
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
          {startPoint && endPoint && !normalRoute && 'Ready to find your route'}
          {normalRoute && 'Route found'}
        </span>
        {routeError && <span className="control-error">{routeError}</span>}
        <button
          type="button"
          disabled={!startPoint || !endPoint || isLoading}
          onClick={handleFindRoute}
        >
          {isLoading ? 'Finding route…' : 'Find Route'}
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
          normalRoute={normalRoute}
        />
      </div>
    </div>
  )
}

export default App
