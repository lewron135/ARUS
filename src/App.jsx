import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as turf from '@turf/turf'
import './App.css'
import MapView from './components/MapView.jsx'
import { getFloodZones } from './api/floodApi.js'
import { getRoute } from './api/routeApi.js'
import { findSafeRoute } from './lib/safeRoute.js'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const WALK_SPEED_KMH = 20

function formatDistance(geometry) {
  const km = turf.length(turf.feature(geometry), { units: 'kilometers' })
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function formatDuration(geometry) {
  const km = turf.length(turf.feature(geometry), { units: 'kilometers' })
  return `${Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60))} min`
}

function shortName(displayName) {
  return displayName?.split(',')[0] ?? ''
}

function severityForZone(zone) {
  const state = zone?.properties?.state ?? 1
  if (state >= 3) return { level: 'CRITICAL', depth: '40-60cm' }
  if (state === 2) return { level: 'MODERATE', depth: '20-40cm' }
  return { level: 'LOW', depth: '10-20cm' }
}

function useGeocodeSuggestions(query) {
  const [results, setResults] = useState([])

  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=id`
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  return results
}

function CityStatusCard({ floodZones }) {
  const criticalCount = floodZones
    ? floodZones.features.filter((f) => (f.properties?.state ?? 1) >= 3).length
    : 0
  const [now] = useState(() =>
    new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  )

  return (
    <div className="status-card">
      <svg className="status-card-icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M2 12h4l2-7 4 14 3-9 2 5h5"
          stroke="#FF4444"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="status-card-body">
        <span className="status-card-label">CITY STATUS</span>
        <span className="status-card-value">{criticalCount} Critical Flood Zones</span>
      </div>
      <div className="status-card-meta">
        <span className="status-card-time">{now} WIB</span>
        <span className="status-card-sync">SYNC: GOV DATA</span>
      </div>
    </div>
  )
}

function LocationInput({ icon, placeholder, text, onChange, suggestions, onSelect, onFocus, onBlur }) {
  return (
    <div className="location-input-row">
      {icon}
      <input
        type="text"
        className="location-input"
        placeholder={placeholder}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {suggestions.length > 0 && (
        <ul className="location-suggestions">
          {suggestions.map((s) => (
            <li key={`${s.lat}-${s.lon}`}>
              <button type="button" onMouseDown={() => onSelect(s)}>
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HomeScreen({
  floodZones,
  startText,
  endText,
  onStartChange,
  onEndChange,
  onSelectStart,
  onSelectEnd,
  startSuggestions,
  endSuggestions,
  onFocusField,
  onBlurField,
  canScan,
  isLoading,
  routeError,
  onScan,
}) {
  return (
    <div className="screen home-screen">
      <div className="home-header">
        <h1 className="app-title">ARUS</h1>
        <span className="app-subtitle">URBAN SURVIVAL SYSTEM // JKT</span>
      </div>

      <CityStatusCard floodZones={floodZones} />

      <div className="input-card">
        <LocationInput
          icon={<span className="input-icon input-icon--start" />}
          placeholder="Start location"
          text={startText}
          onChange={onStartChange}
          suggestions={startSuggestions}
          onSelect={onSelectStart}
          onFocus={() => onFocusField('start')}
          onBlur={onBlurField}
        />
        <div className="input-divider" />
        <LocationInput
          icon={<span className="input-icon input-icon--end" />}
          placeholder="Destination"
          text={endText}
          onChange={onEndChange}
          suggestions={endSuggestions}
          onSelect={onSelectEnd}
          onFocus={() => onFocusField('end')}
          onBlur={onBlurField}
        />
      </div>

      {routeError && <span className="control-error">{routeError}</span>}

      <button type="button" className="scan-button" disabled={!canScan || isLoading} onClick={onScan}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
        {isLoading ? 'SCANNING…' : 'SCAN SAFE ROUTES'}
      </button>

      <div className="mini-cards">
        <div className="mini-card">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z"
              stroke="#1A1A1A"
              strokeWidth="1.6"
            />
            <circle cx="12" cy="10" r="2.4" stroke="#1A1A1A" strokeWidth="1.6" />
          </svg>
          <span className="mini-card-title">Pin Flood Area</span>
          <span className="mini-card-tag">+50 PTS</span>
        </div>
        <div className="mini-card">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#1A1A1A" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="3" stroke="#1A1A1A" strokeWidth="1.6" />
          </svg>
          <span className="mini-card-title">Emergency Help</span>
          <span className="mini-card-tag mini-card-tag--warn">OFFICIAL PARTNERS</span>
        </div>
      </div>
    </div>
  )
}

function MapScreen({
  floodZones,
  startPoint,
  endPoint,
  normalRoute,
  safeRoute,
  noSafeRouteFound,
  destinationName,
  anomalyCount,
  onBack,
  onStartNav,
}) {
  const routeNeededDetour = normalRoute && safeRoute && safeRoute !== normalRoute
  const primaryRoute = safeRoute ?? normalRoute
  const altZone = routeNeededDetour ? findFloodZoneNear(normalRoute, floodZones) : null
  const altSeverity = altZone ? severityForZone(altZone) : { depth: '30-45cm' }

  return (
    <div className="screen map-screen">
      <MapView
        floodZones={floodZones}
        startPoint={startPoint}
        endPoint={endPoint}
        normalRoute={normalRoute}
        safeRoute={safeRoute}
      />

      <button type="button" className="back-fab" onClick={onBack} aria-label="Back">
        ←
      </button>

      <div className="radar-badge">
        <span className="radar-badge-title">RADAR ACTIVE</span>
        <span className="radar-badge-detail">
          <span className="radar-dot" />
          {anomalyCount} ANOMALY DETECTED
        </span>
      </div>

      {primaryRoute && (
        <div className="result-sheet">
          <span className="result-label">DESTINATION SECURED</span>
          <span className="result-destination">{destinationName || 'Destination'}</span>

          <div className="route-row route-row--primary">
            <span className="route-row-icon route-row-icon--safe">🛡</span>
            <div className="route-row-body">
              <div className="route-row-heading">
                <span className="route-row-title route-row-title--safe">Primary Route</span>
                <span className="route-badge route-badge--safe">
                  {noSafeRouteFound ? 'DIRECT' : 'SAFE'}
                </span>
              </div>
              <span className="route-row-desc">
                {noSafeRouteFound
                  ? 'No safe detour found'
                  : routeNeededDetour
                  ? 'Avoids flooded segment'
                  : 'Clear of flood zones'}
              </span>
            </div>
            <div className="route-row-stats">
              <span className="route-row-time">{formatDuration(primaryRoute)}</span>
              <span className="route-row-distance">{formatDistance(primaryRoute)}</span>
            </div>
          </div>

          {routeNeededDetour && (
            <div className="route-row route-row--alt">
              <span className="route-row-icon route-row-icon--danger">⚠</span>
              <div className="route-row-body">
                <span className="route-row-title route-row-title--danger">Alt Route</span>
                <span className="route-row-desc">Submerged {altSeverity.depth}</span>
              </div>
              <span className="route-row-risk">RISK HIGH</span>
            </div>
          )}

          <div className="result-actions">
            <button type="button" className="start-nav-button" onClick={onStartNav}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M4 20l16-8L4 4l3 8-3 8z" fill="currentColor" />
              </svg>
              START NAV
            </button>
            <button type="button" className="ride-button">
              🛵 Ride <span className="ride-api-tag">API</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function findFloodZoneNear(routeGeometry, floodZones) {
  if (!floodZones) return null
  const line = turf.feature(routeGeometry)
  return floodZones.features.find((zone) => turf.booleanIntersects(line, zone)) ?? null
}

function NavigatingScreen({
  floodZones,
  startPoint,
  endPoint,
  safeRoute,
  normalRoute,
  routeNeededDetour,
  onClose,
}) {
  const [eta] = useState(() => {
    const km = safeRoute ? turf.length(turf.feature(safeRoute), { units: 'kilometers' }) : 0
    const minutes = Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60))
    const arrival = new Date(Date.now() + minutes * 60000)
    const arrivalLabel = arrival.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    })
    return { minutes, arrivalLabel }
  })

  return (
    <div className="screen nav-screen">
      <MapView
        floodZones={floodZones}
        startPoint={startPoint}
        endPoint={endPoint}
        normalRoute={normalRoute}
        safeRoute={safeRoute}
        navigating
      />

      <div className="nav-top">
        <div className="nav-instruction-card">
          <span className="nav-turn-icon">↗</span>
          <div className="nav-instruction-body">
            <span className="nav-distance">
              {safeRoute ? formatDistance(safeRoute) : '--'} <span className="nav-distance-unit">TO GO</span>
            </span>
            <span className="nav-instruction-text">Follow the highlighted route ahead</span>
          </div>
        </div>

        {routeNeededDetour && (
          <div className="reroute-banner">
            <span className="reroute-icon">⚠</span>
            <div className="reroute-body">
              <span className="reroute-title">TACTICAL REROUTE</span>
              <span className="reroute-desc">AI detected new flooding on original route. Rerouting active.</span>
            </div>
          </div>
        )}
      </div>

      <div className="nav-bottom">
        <div className="nav-eta">
          <span className="nav-eta-value">{eta.minutes}</span>
          <span className="nav-eta-unit">MIN</span>
        </div>
        <div className="nav-meta">
          <span>{safeRoute ? formatDistance(safeRoute) : '--'}</span>
          <span className="nav-meta-sep">|</span>
          <span>ETA {eta.arrivalLabel}</span>
        </div>
        <button type="button" className="nav-close-button" onClick={onClose} aria-label="End navigation">
          ✕
        </button>
      </div>
    </div>
  )
}

function App() {
  const [floodZones, setFloodZones] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)
  const [startText, setStartText] = useState('')
  const [endText, setEndText] = useState('')
  const [activeField, setActiveField] = useState(null)
  const [normalRoute, setNormalRoute] = useState(null)
  const [safeRoute, setSafeRoute] = useState(null)
  const [noSafeRouteFound, setNoSafeRouteFound] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [navigationMode, setNavigationMode] = useState('home')
  const blurTimer = useRef(null)

  const startSuggestions = useGeocodeSuggestions(activeField === 'start' ? startText : '')
  const endSuggestions = useGeocodeSuggestions(activeField === 'end' ? endText : '')

  useEffect(() => {
    getFloodZones().then(setFloodZones)
  }, [])

  function handleFocusField(field) {
    clearTimeout(blurTimer.current)
    setActiveField(field)
  }

  function handleBlurField() {
    blurTimer.current = setTimeout(() => setActiveField(null), 120)
  }

  function handleStartChange(value) {
    setStartText(value)
    setStartPoint(null)
  }

  function handleEndChange(value) {
    setEndText(value)
    setEndPoint(null)
  }

  function handleSelectStart(result) {
    setStartPoint({ lat: Number(result.lat), lng: Number(result.lon) })
    setStartText(shortName(result.display_name))
    setActiveField(null)
  }

  function handleSelectEnd(result) {
    setEndPoint({ lat: Number(result.lat), lng: Number(result.lon) })
    setEndText(shortName(result.display_name))
    setActiveField(null)
  }

  async function handleScan() {
    setIsLoading(true)
    setRouteError(null)
    setNoSafeRouteFound(false)
    try {
      const normal = await getRoute([startPoint, endPoint])
      setNormalRoute(normal)

      const safe = await findSafeRoute(startPoint, endPoint, normal, floodZones)
      setSafeRoute(safe)
      setNoSafeRouteFound(safe === null)
      setNavigationMode('map')
    } catch (err) {
      setRouteError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleBackToHome() {
    setNavigationMode('home')
  }

  function handleStartNav() {
    setNavigationMode('navigating')
  }

  function handleCloseNav() {
    setNavigationMode('map')
  }

  const routeNeededDetour = Boolean(normalRoute && safeRoute && safeRoute !== normalRoute)
  const anomalyCount = normalRoute && floodZones
    ? floodZones.features.filter((zone) => turf.booleanIntersects(turf.feature(normalRoute), zone)).length
    : 0

  return (
    <div className="app">
      {navigationMode === 'home' &&
        createPortal(
          <HomeScreen
            floodZones={floodZones}
            startText={startText}
            endText={endText}
            onStartChange={handleStartChange}
            onEndChange={handleEndChange}
            onSelectStart={handleSelectStart}
            onSelectEnd={handleSelectEnd}
            startSuggestions={startSuggestions}
            endSuggestions={endSuggestions}
            onFocusField={handleFocusField}
            onBlurField={handleBlurField}
            canScan={Boolean(startPoint && endPoint)}
            isLoading={isLoading}
            routeError={routeError}
            onScan={handleScan}
          />,
          document.body
        )}

      {navigationMode === 'map' &&
        createPortal(
          <MapScreen
            floodZones={floodZones}
            startPoint={startPoint}
            endPoint={endPoint}
            normalRoute={normalRoute}
            safeRoute={safeRoute}
            noSafeRouteFound={noSafeRouteFound}
            destinationName={endText}
            anomalyCount={anomalyCount}
            onBack={handleBackToHome}
            onStartNav={handleStartNav}
          />,
          document.body
        )}

      {navigationMode === 'navigating' &&
        createPortal(
          <NavigatingScreen
            floodZones={floodZones}
            startPoint={startPoint}
            endPoint={endPoint}
            safeRoute={safeRoute}
            normalRoute={normalRoute}
            routeNeededDetour={routeNeededDetour}
            onClose={handleCloseNav}
          />,
          document.body
        )}
    </div>
  )
}

export default App
