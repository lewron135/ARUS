import { useEffect, useRef, useState } from 'react'
import * as turf from '@turf/turf'
import './App.css'
import MapView, { JAKARTA_CENTER, PinPickerMap } from './components/MapView.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { getFloodZones } from './api/floodApi.js'
import { getRoute } from './api/routeApi.js'
import { findSafeRoute } from './lib/safeRoute.js'

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const WALK_SPEED_KMH = 20
const JAKARTA_CENTER_POINT = { lat: JAKARTA_CENTER[0], lng: JAKARTA_CENTER[1] }

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
      const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=id`
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  return results
}

async function reverseGeocode(point) {
  const url = `${NOMINATIM_REVERSE_URL}?lat=${point.lat}&lon=${point.lng}&format=json`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    return data?.display_name ? shortName(data.display_name) : null
  } catch {
    return null
  }
}

function areaSeverity(state) {
  if (state >= 3) return { label: 'CRITICAL', tier: 'critical' }
  if (state === 2) return { label: 'MODERATE', tier: 'moderate' }
  return { label: 'LOW', tier: 'low' }
}

// PetaBencana reports at RT level (area_name) inside a kelurahan
// (parent_name) — RT names alone aren't recognizable, so prefer the
// kelurahan/seed name and collapse duplicates to their worst severity.
function affectedAreas(floodZones) {
  if (!floodZones) return []
  const worstByName = new Map()
  for (const feature of floodZones.features) {
    const props = feature.properties ?? {}
    const name = props.name || props.parent_name || props.area_name || 'Unknown area'
    const state = props.state ?? 1
    if (!worstByName.has(name) || state > worstByName.get(name)) {
      worstByName.set(name, state)
    }
  }
  return [...worstByName.entries()]
    .map(([name, state]) => ({ name, state }))
    .sort((a, b) => b.state - a.state)
}

function CityStatusCard({ floodZones }) {
  const areas = affectedAreas(floodZones)
  const criticalCount = areas.filter((a) => a.state >= 3).length
  const visibleAreas = areas.slice(0, 3)
  const remaining = areas.length - visibleAreas.length
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
      <div className="status-card-top">
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

      {visibleAreas.length > 0 && (
        <div className="status-area-list">
          {visibleAreas.map((area) => {
            const severity = areaSeverity(area.state)
            return (
              <div className="status-area-row" key={area.name}>
                <span className={`status-area-dot status-area-dot--${severity.tier}`} />
                <span className="status-area-name">{area.name}</span>
                <span className={`status-area-badge status-area-badge--${severity.tier}`}>{severity.label}</span>
              </div>
            )
          })}
          {remaining > 0 && (
            <span className="status-area-more">
              +{remaining} more area{remaining > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function PinMarkerIcon({ variant }) {
  return (
    <svg width="38" height="50" viewBox="0 0 38 50" fill="none">
      <path
        d="M19 1C9.6 1 2 8.6 2 18c0 12.4 17 30 17 30s17-17.6 17-30c0-9.4-7.6-17-17-17z"
        fill={variant === 'start' ? '#00E5A0' : '#FF4444'}
        stroke="#fff"
        strokeWidth="2"
      />
      <circle cx="19" cy="18" r="6.5" fill="#fff" />
    </svg>
  )
}

function PinPickerScreen({ target, floodZones, initialPoint, initialAddress, defaultCenter, onConfirm, onBack }) {
  const seedPoint = initialPoint ?? defaultCenter ?? JAKARTA_CENTER_POINT
  const [query, setQuery] = useState('')
  const [pinPoint, setPinPoint] = useState(seedPoint)
  const [address, setAddress] = useState(initialAddress || '')
  const [isResolving, setIsResolving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [flyTarget, setFlyTarget] = useState(null)
  const resolveTimer = useRef(null)
  const requestToken = useRef(0)

  const suggestions = useGeocodeSuggestions(query)

  function scheduleReverseGeocode(point) {
    clearTimeout(resolveTimer.current)
    setIsResolving(true)
    const token = ++requestToken.current
    resolveTimer.current = setTimeout(() => {
      reverseGeocode(point).then((label) => {
        if (requestToken.current !== token) return
        setAddress(label ?? 'Unknown location')
        setIsResolving(false)
      })
    }, 500)
  }

  useEffect(() => {
    if (!initialAddress) scheduleReverseGeocode(seedPoint)
    return () => clearTimeout(resolveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDragStart() {
    setIsDragging(true)
  }

  function handleCenterChange(point) {
    setIsDragging(false)
    setPinPoint(point)
    scheduleReverseGeocode(point)
  }

  function handleSelectSuggestion(result) {
    const point = { lat: Number(result.lat), lng: Number(result.lon) }
    setPinPoint(point)
    setAddress(shortName(result.display_name))
    setIsResolving(false)
    setQuery('')
    setFlyTarget(point)
  }

  function handleConfirm() {
    if (!pinPoint || isResolving) return
    onConfirm(pinPoint, address || 'Selected location')
  }

  return (
    <div className="screen pin-screen">
      <div className="map-canvas">
        <PinPickerMap
          floodZones={floodZones}
          initialCenter={[seedPoint.lat, seedPoint.lng]}
          flyToTarget={flyTarget}
          onDragStart={handleDragStart}
          onCenterChange={handleCenterChange}
        />
      </div>

      <div className={`pin-marker${isDragging ? ' pin-marker--dragging' : ''}`}>
        <PinMarkerIcon variant={target} />
      </div>
      <div className={`pin-marker-shadow${isDragging ? ' pin-marker-shadow--dragging' : ''}`} />

      <button type="button" className="back-fab" onClick={onBack} aria-label="Back">
        ←
      </button>

      <div className="pin-search-wrap">
        <div className="pin-search-card">
          <input
            type="text"
            className="pin-search-input"
            placeholder={target === 'start' ? 'Search start location' : 'Search destination'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="location-suggestions">
              {suggestions.map((s) => (
                <li key={`${s.lat}-${s.lon}`}>
                  <button type="button" onMouseDown={() => handleSelectSuggestion(s)}>
                    {s.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="pin-bottom">
        <span className="pin-bottom-label">{target === 'start' ? 'TITIK AWAL' : 'TITIK TUJUAN'}</span>
        <span className="pin-bottom-address">
          {isResolving ? 'Detecting address…' : address || 'Drag the map to pin your location'}
        </span>
        <button
          type="button"
          className="scan-button pin-confirm-button"
          disabled={!pinPoint || isResolving}
          onClick={handleConfirm}
        >
          Confirm Location
        </button>
      </div>
    </div>
  )
}

function HomeScreen({
  floodZones,
  startText,
  endText,
  onOpenStartPicker,
  onOpenEndPicker,
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
        <button type="button" className="location-row" onClick={onOpenStartPicker}>
          <span className="input-icon input-icon--start" />
          <span className={`location-row-text${startText ? '' : ' location-row-text--placeholder'}`}>
            {startText || 'Start, e.g. Cipinang Jaya, Jatinegara'}
          </span>
        </button>
        <div className="input-divider" />
        <button type="button" className="location-row" onClick={onOpenEndPicker}>
          <span className="input-icon input-icon--end" />
          <span className={`location-row-text${endText ? '' : ' location-row-text--placeholder'}`}>
            {endText || 'Destination, e.g. Cipinang Muara Raya'}
          </span>
        </button>
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
  isLoading,
  onBack,
  onStartNav,
}) {
  const routeNeededDetour = normalRoute && safeRoute && safeRoute !== normalRoute
  const primaryRoute = safeRoute ?? normalRoute
  const altZone = routeNeededDetour ? findFloodZoneNear(normalRoute, floodZones) : null
  const altSeverity = altZone ? severityForZone(altZone) : { depth: '30-45cm' }

  return (
    <div className="screen map-screen">
      <div className="map-canvas">
        <MapView
          floodZones={floodZones}
          startPoint={startPoint}
          endPoint={endPoint}
          normalRoute={normalRoute}
          safeRoute={safeRoute}
          fitBoundsTopPadding={90}
          fitBoundsBottomPadding={260}
        />
      </div>

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

      {!primaryRoute && isLoading && (
        <div className="result-sheet">
          <span className="result-label">SCANNING</span>
          <span className="result-destination">Checking flood zones along the route…</span>
        </div>
      )}

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
      <div className="map-canvas">
        <MapView
          floodZones={floodZones}
          startPoint={startPoint}
          endPoint={endPoint}
          normalRoute={normalRoute}
          safeRoute={safeRoute}
          navigating
          fitBoundsTopPadding={routeNeededDetour ? 180 : 110}
          fitBoundsBottomPadding={130}
        />
      </div>

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
  const [normalRoute, setNormalRoute] = useState(null)
  const [safeRoute, setSafeRoute] = useState(null)
  const [noSafeRouteFound, setNoSafeRouteFound] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [navigationMode, setNavigationMode] = useState('home')
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    getFloodZones().then(setFloodZones)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  async function runScan(start, end) {
    setIsLoading(true)
    setRouteError(null)
    setNoSafeRouteFound(false)
    setNormalRoute(null)
    setSafeRoute(null)
    try {
      const normal = await getRoute([start, end])
      setNormalRoute(normal)

      const safe = await findSafeRoute(start, end, normal, floodZones)
      setSafeRoute(safe)
      setNoSafeRouteFound(safe === null)
    } catch (err) {
      setRouteError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleScan() {
    setNavigationMode('map')
    runScan(startPoint, endPoint)
  }

  function handleOpenStartPicker() {
    setNavigationMode('pin-start')
  }

  function handleOpenEndPicker() {
    setNavigationMode('pin-end')
  }

  function handlePinBack() {
    setNavigationMode('home')
  }

  // Confirming a pin auto-chains to the other pin picker when it's still
  // unset, or straight to results once both points are known (Gojek-style
  // pickup -> destination -> route flow) — this fires whichever picker was
  // just confirmed, including re-edits of an already-complete pair.
  function handlePinConfirm(point, address) {
    const wasStart = navigationMode === 'pin-start'
    const otherPoint = wasStart ? endPoint : startPoint

    if (wasStart) {
      setStartPoint(point)
      setStartText(address)
    } else {
      setEndPoint(point)
      setEndText(address)
    }

    if (otherPoint) {
      setNavigationMode('map')
      runScan(wasStart ? point : startPoint, wasStart ? otherPoint : point)
    } else {
      setNavigationMode(wasStart ? 'pin-end' : 'pin-start')
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
    ? floodZones.features.filter((zone) =>
        turf.booleanIntersects(turf.buffer(turf.feature(normalRoute), 0.4, { units: 'kilometers' }), zone)
      ).length
    : 0

  return (
    <div className="app">
      <div className="phone-frame">
        {showSplash ? (
          <SplashScreen />
        ) : (
          <>
            {navigationMode === 'home' && (
              <HomeScreen
                floodZones={floodZones}
                startText={startText}
                endText={endText}
                onOpenStartPicker={handleOpenStartPicker}
                onOpenEndPicker={handleOpenEndPicker}
                canScan={Boolean(startPoint && endPoint)}
                isLoading={isLoading}
                routeError={routeError}
                onScan={handleScan}
              />
            )}

            {navigationMode === 'pin-start' && (
              <PinPickerScreen
                target="start"
                floodZones={floodZones}
                initialPoint={startPoint}
                initialAddress={startText}
                defaultCenter={startPoint}
                onConfirm={handlePinConfirm}
                onBack={handlePinBack}
              />
            )}

            {navigationMode === 'pin-end' && (
              <PinPickerScreen
                target="end"
                floodZones={floodZones}
                initialPoint={endPoint}
                initialAddress={endText}
                defaultCenter={endPoint ?? startPoint}
                onConfirm={handlePinConfirm}
                onBack={handlePinBack}
              />
            )}

            {navigationMode === 'map' && (
              <MapScreen
                floodZones={floodZones}
                startPoint={startPoint}
                endPoint={endPoint}
                normalRoute={normalRoute}
                safeRoute={safeRoute}
                noSafeRouteFound={noSafeRouteFound}
                destinationName={endText}
                anomalyCount={anomalyCount}
                isLoading={isLoading}
                onBack={handleBackToHome}
                onStartNav={handleStartNav}
              />
            )}

            {navigationMode === 'navigating' && (
              <NavigatingScreen
                floodZones={floodZones}
                startPoint={startPoint}
                endPoint={endPoint}
                safeRoute={safeRoute}
                normalRoute={normalRoute}
                routeNeededDetour={routeNeededDetour}
                onClose={handleCloseNav}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
