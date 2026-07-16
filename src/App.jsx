import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import * as turf from '@turf/turf'
import './App.css'
import MapView from './components/MapView.jsx'
import { getFloodZones } from './api/floodApi.js'
import { getRoute } from './api/routeApi.js'
import { findSafeRoute } from './lib/safeRoute.js'

function formatDistance(geometry) {
  const km = turf.length(turf.feature(geometry), { units: 'kilometers' })
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function App() {
  const [floodZones, setFloodZones] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)
  const [normalRoute, setNormalRoute] = useState(null)
  const [safeRoute, setSafeRoute] = useState(null)
  const [noSafeRouteFound, setNoSafeRouteFound] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)

  useEffect(() => {
    getFloodZones().then(setFloodZones)
  }, [])

  function resetRouteState() {
    setNormalRoute(null)
    setSafeRoute(null)
    setNoSafeRouteFound(false)
    setRouteError(null)
  }

  function handleMapClick(point) {
    if (!startPoint) {
      setStartPoint(point)
    } else if (!endPoint) {
      setEndPoint(point)
    } else {
      setStartPoint(point)
      setEndPoint(null)
    }
    resetRouteState()
  }

  function handleReset() {
    setStartPoint(null)
    setEndPoint(null)
    resetRouteState()
  }

  async function handleFindRoute() {
    setIsLoading(true)
    setRouteError(null)
    setNoSafeRouteFound(false)
    try {
      const normal = await getRoute([startPoint, endPoint])
      setNormalRoute(normal)

      const safe = await findSafeRoute(startPoint, endPoint, normal, floodZones)
      setSafeRoute(safe)
      setNoSafeRouteFound(safe === null)
    } catch (err) {
      setRouteError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const showDangerCard = normalRoute && safeRoute !== normalRoute
  const routeNeededDetour = showDangerCard && Boolean(safeRoute)
  const hasRoutes = Boolean(normalRoute)

  return (
    <div className="app">
      <MapView
        floodZones={floodZones}
        startPoint={startPoint}
        endPoint={endPoint}
        onMapClick={handleMapClick}
        normalRoute={normalRoute}
        safeRoute={safeRoute}
      />

      {createPortal(
        <>
          <div className="top-overlay">
            <span className="brand">ARUS</span>
            <span className="brand-dot">•</span>
            <span className="brand-sub">Rute Aman, Hindari Banjir</span>
          </div>

          <div className="bottom-bar">
            <div className="bottom-card-wrap">
              {hasRoutes ? (
                <div className="route-cards">
                  {showDangerCard && (
                    <div className="route-card route-card--danger">
                      <div className="route-card-heading">
                        <span className="route-card-dot" />
                        <span className="route-card-label">Rute Biasa</span>
                      </div>
                      <span className="route-card-desc">melewati banjir</span>
                      <span className="route-card-stat">{formatDistance(normalRoute)}</span>
                    </div>
                  )}
                  {safeRoute && (
                    <div className="route-card route-card--safe">
                      <div className="route-card-heading">
                        <span className="route-card-dot" />
                        <span className="route-card-label">Rute Aman</span>
                      </div>
                      <span className="route-card-desc">
                        {routeNeededDetour ? 'hindari banjir' : 'tidak melewati banjir'}
                      </span>
                      <span className="route-card-stat">{formatDistance(safeRoute)}</span>
                    </div>
                  )}
                  {noSafeRouteFound && (
                    <div className="route-card route-card--warning">
                      <div className="route-card-heading">
                        <span className="route-card-dot" />
                        <span className="route-card-label">Tidak ada rute aman</span>
                      </div>
                      <span className="route-card-desc">menampilkan rute langsung</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hint-card">
                  <span className="control-hint">
                    {!startPoint && 'Ketuk peta untuk titik awal'}
                    {startPoint && !endPoint && 'Ketuk peta untuk titik tujuan'}
                    {startPoint && endPoint && !isLoading && 'Siap mencari rute'}
                    {isLoading && 'Mencari rute…'}
                  </span>
                  {routeError && <span className="control-error">{routeError}</span>}
                </div>
              )}
            </div>

            <div className="fab-stack">
              {(startPoint || endPoint) && (
                <button
                  type="button"
                  className="fab fab-secondary"
                  onClick={handleReset}
                  aria-label="Reset"
                >
                  ↺
                </button>
              )}
              <button
                type="button"
                className="fab fab-primary"
                disabled={!startPoint || !endPoint || isLoading}
                onClick={handleFindRoute}
                aria-label="Cari rute"
              >
                {isLoading ? '…' : '➜'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export default App
