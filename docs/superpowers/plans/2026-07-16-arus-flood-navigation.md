# ARUS Flood-Aware Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ARUS, a single-page pedestrian navigation app for Jakarta that shows a normal route and a flood-avoiding detour route side by side on a dark map.

**Architecture:** React + Vite SPA. `App.jsx` owns all state (points, flood zones, routes). A `MapView` component renders a Leaflet map with dark tiles, flood polygons, and route lines. Three plain-function modules (`floodApi.js`, `routeApi.js`, `safeRoute.js`) handle all network/geometry logic so `App.jsx` stays a thin coordinator.

**Tech Stack:** React 19, Vite, react-leaflet + leaflet, @turf/turf, native `fetch` (no axios — unnecessary given `fetch` covers both APIs).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-arus-flood-navigation-design.md`
- Testing is **manual only**, via `npm run dev` + browser — no automated test suite (approved scope). Each task's "Verify" step replaces a test-run step.
- Colors: background `#1A1209`, safe route `#00E5A0` (solid), normal/flood route `#FF4444` (dashed for normal, low-opacity fill for flood zones).
- Map center: Jakarta, `[-6.2088, 106.8456]` (lat, lng), zoom 13.
- Tile layer: CartoDB Dark Matter, `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` (no API key).
- PetaBencana: `https://data.petabencana.id/floods?admin=ID-JK&minimum_state=1&geoformat=geojson` → response is `{ statusCode, result: { type: "FeatureCollection", features: [...] } }`, geometries are `MultiPolygon`, CORS is open.
- OSRM: `https://router.project-osrm.org/route/v1/foot/{lng},{lat};...?overview=full&geometries=geojson` → always exactly 1 route (public server never returns alternatives — verified live). Coordinates in the URL are `lng,lat`; everywhere else in our code, points are `{lat, lng}` objects.
- Seed flood data already exists at `src/data/seedFloods.json` (5 named zones, `Polygon` geometries, `properties.state`) and must always be included in `getFloodZones()`'s result, not just used as a failure fallback.

---

### Task 1: Project setup, dependencies, dark shell

**Files:**
- Modify: `package.json`
- Modify: `index.html`
- Modify: `src/main.jsx`
- Modify: `src/index.css`
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Delete: `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`

**Interfaces:**
- Produces: a rendered `<div className="app">` shell with `.app-header` and `.map-area` — later tasks mount `MapView` inside `.map-area`.

- [ ] **Step 1: Read the frontend-design skill before touching any styling**

Invoke the `frontend-design` skill (via the Skill tool) and read its guidance once now — Tasks 1, 2, and 6 all touch color/typography/layout and should follow it consistently rather than re-deriving style choices per task.

- [ ] **Step 2: Install dependencies**

```bash
npm install leaflet react-leaflet @turf/turf
```

Expected: `package.json` `dependencies` gains `leaflet`, `react-leaflet`, `@turf/turf`; `package-lock.json` updates; no peer-dependency errors (react-leaflet v5+ supports React 19).

- [ ] **Step 3: Rename the package**

Edit `package.json`, change:

```json
  "name": "arus-tmp",
```

to:

```json
  "name": "arus",
```

- [ ] **Step 4: Update the page title**

Edit `index.html`, change:

```html
    <title>arus-tmp</title>
```

to:

```html
    <title>ARUS</title>
```

- [ ] **Step 5: Delete unused default-template assets**

```bash
rm src/assets/react.svg src/assets/vite.svg src/assets/hero.png
```

- [ ] **Step 6: Replace `src/index.css` with a dark-theme reset**

```css
:root {
  color-scheme: dark;
  font: 16px/1.45 system-ui, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background: #1a1209;
  color: #e8e1d4;
}
```

- [ ] **Step 7: Replace `src/App.css` with the shell layout**

```css
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(232, 225, 212, 0.12);
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-shrink: 0;
}

.app-header h1 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #e8e1d4;
  margin: 0;
}

.app-header .tagline {
  font-size: 13px;
  color: rgba(232, 225, 212, 0.55);
}

.map-area {
  flex: 1;
  position: relative;
}
```

- [ ] **Step 8: Replace `src/App.jsx` with the minimal shell**

```jsx
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>ARUS</h1>
        <span className="tagline">Flood-aware pedestrian routes for Jakarta</span>
      </header>
      <div className="map-area" />
    </div>
  )
}

export default App
```

- [ ] **Step 9: Verify in browser**

Run: `npm run dev`, open the printed localhost URL.

Expected: dark (`#1A1209`) full-height page, header reading "ARUS — Flood-aware pedestrian routes for Jakarta", browser tab titled "ARUS", no console errors, no leftover Vite/React logos anywhere.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json index.html src/main.jsx src/index.css src/App.css src/App.jsx
git rm src/assets/react.svg src/assets/vite.svg src/assets/hero.png
git commit -m "Set up ARUS project shell and dependencies"
```

---

### Task 2: Map view with dark tiles

**Files:**
- Create: `src/components/MapView.jsx`
- Modify: `src/main.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `MapView` React component, default export, currently taking no props, rendering a full-size Leaflet map. Later tasks add props `floodZones`, `normalRoute`, `safeRoute`, `startPoint`, `endPoint`, `onMapClick`.

- [ ] **Step 1: Import Leaflet's CSS globally**

Edit `src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Create `src/components/MapView.jsx`**

```jsx
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
```

- [ ] **Step 3: Mount it in `App.jsx`**

```jsx
import './App.css'
import MapView from './components/MapView.jsx'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>ARUS</h1>
        <span className="tagline">Flood-aware pedestrian routes for Jakarta</span>
      </header>
      <div className="map-area">
        <MapView />
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`, open the app.

Expected: the `.map-area` below the header is filled edge-to-edge with dark CartoDB tiles centered on Jakarta at zoom 13; mouse wheel zooms, drag pans; no console errors about missing Leaflet CSS (tiles should render with sharp edges, not as broken/oversized images).

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx src/App.jsx src/components/MapView.jsx
git commit -m "Add dark-tile Leaflet map view"
```

---

### Task 3: Flood zone data (merged live + seed) and rendering

**Files:**
- Create: `src/api/floodApi.js`
- Modify: `src/components/MapView.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `getFloodZones(): Promise<FeatureCollection>` from `floodApi.js` — always includes the seed zones; appends live features when the fetch succeeds.
- Consumes (MapView): new prop `floodZones` (a GeoJSON `FeatureCollection` or `null` before the first load).

- [ ] **Step 1: Create `src/api/floodApi.js`**

```js
const PETABENCANA_URL =
  'https://data.petabencana.id/floods?admin=ID-JK&minimum_state=1&geoformat=geojson'

export async function getFloodZones() {
  const seed = (await import('../data/seedFloods.json')).default

  try {
    const res = await fetch(PETABENCANA_URL)
    if (!res.ok) throw new Error(`PetaBencana responded ${res.status}`)
    const json = await res.json()
    const liveFeatures = json?.result?.features
    if (!Array.isArray(liveFeatures)) throw new Error('Unexpected PetaBencana response shape')

    return {
      type: 'FeatureCollection',
      features: [...seed.features, ...liveFeatures],
    }
  } catch {
    return seed
  }
}
```

- [ ] **Step 2: Render flood zones in `MapView.jsx`**

```jsx
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
```

(The `key` forces react-leaflet to re-create the GeoJSON layer when the feature count changes, since `<GeoJSON>` doesn't diff its `data` prop internally.)

- [ ] **Step 3: Fetch flood zones on mount in `App.jsx`**

```jsx
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
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`, open the app, open DevTools Network tab.

Expected: a request to `data.petabencana.id` succeeds (status 200); the map shows translucent red polygons at all 5 seed locations (Kampung Melayu, Bukit Duri, Cipinang Melayu, Kemang Selatan, Muara Baru/Pluit — visible by panning/zooming to those areas) **plus** at least one more polygon from the live response, confirming the merge (not replacement) behavior.

- [ ] **Step 5: Commit**

```bash
git add src/api/floodApi.js src/components/MapView.jsx src/App.jsx
git commit -m "Fetch and render merged live/seed flood zones"
```

---

### Task 4: Click-to-place start/end pins and route control

**Files:**
- Modify: `src/components/MapView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces (App.jsx): state `startPoint`, `endPoint` — each either `null` or `{ lat: number, lng: number }`.
- Consumes/Produces (MapView): new props `startPoint`, `endPoint`, `onMapClick(latlng: { lat, lng })`. Renders `Marker`s for whichever points are set and forwards raw map clicks via `onMapClick`.

- [ ] **Step 1: Add click handling and markers to `MapView.jsx`**

```jsx
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
```

- [ ] **Step 2: Add point state, click-to-place logic, and a control bar to `App.jsx`**

```jsx
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
```

- [ ] **Step 3: Style the control bar in `App.css`**

Add to the end of `src/App.css`:

```css
.control-bar {
  padding: 10px 20px;
  border-bottom: 1px solid rgba(232, 225, 212, 0.12);
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.control-hint {
  font-size: 13px;
  color: rgba(232, 225, 212, 0.7);
  flex: 1;
}

.control-bar button {
  font: inherit;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.control-bar button[type='button']:not(.reset-button) {
  background: #00e5a0;
  color: #0a1410;
  font-weight: 600;
}

.control-bar button:disabled {
  background: rgba(232, 225, 212, 0.15);
  color: rgba(232, 225, 212, 0.4);
  cursor: not-allowed;
}

.reset-button {
  background: transparent;
  color: rgba(232, 225, 212, 0.7);
  border: 1px solid rgba(232, 225, 212, 0.25) !important;
}
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`, open the app.

Expected: hint text reads "Click the map to set your start point"; clicking the map drops a marker and hint changes to "...set your destination"; a second click drops a second marker, "Find Route" button becomes enabled (teal), hint reads "Ready to find your route"; a third click moves the start marker to the new spot and clears the end marker; "Reset" clears both markers and the button disables again.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView.jsx src/App.jsx src/App.css
git commit -m "Add click-to-place start/end points and route control bar"
```

---

### Task 5: Normal route fetching and rendering

**Files:**
- Create: `src/api/routeApi.js`
- Modify: `src/components/MapView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `getRoute(points: Array<{ lat, lng }>): Promise<GeoJSON LineString>` from `routeApi.js`. `points` must have 2+ entries (start, optional via points, end); throws on non-2xx or OSRM `code !== 'Ok'`.
- Consumes/Produces (MapView): new prop `normalRoute` (a GeoJSON LineString geometry or `null`), rendered as a dashed red Polyline.
- Produces (App.jsx): state `normalRoute`, `isLoading`, `routeError`; `handleFindRoute` async handler wired to the button.

- [ ] **Step 1: Create `src/api/routeApi.js`**

```js
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot/'

export async function getRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}${coords}?overview=full&geometries=geojson`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`)

  const json = await res.json()
  if (json.code !== 'Ok' || !json.routes?.[0]) {
    throw new Error(`OSRM could not find a route (code: ${json.code})`)
  }

  return json.routes[0].geometry
}
```

- [ ] **Step 2: Render the normal route in `MapView.jsx`**

Add the `Polyline` import and rendering (full file):

```jsx
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, useMapEvents } from 'react-leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

const floodZoneStyle = () => ({
  color: '#FF4444',
  weight: 1,
  fillColor: '#FF4444',
  fillOpacity: 0.35,
})

function toLatLngs(lineGeometry) {
  return lineGeometry.coordinates.map(([lng, lat]) => [lat, lng])
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function MapView({ floodZones, startPoint, endPoint, onMapClick, normalRoute }) {
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
      {normalRoute && (
        <Polyline
          positions={toLatLngs(normalRoute)}
          pathOptions={{ color: '#FF4444', weight: 4, dashArray: '8, 8' }}
        />
      )}
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  )
}

export default MapView
```

- [ ] **Step 3: Wire up route-finding in `App.jsx`**

```jsx
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
```

- [ ] **Step 4: Add error-text styling to `App.css`**

Add to the end of `src/App.css`:

```css
.control-error {
  font-size: 13px;
  color: #ff4444;
}
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`, open the app. Click start near `-6.2185, 106.8570` and end near `-6.2185, 106.8680` (crosses the Kampung Melayu seed flood zone), then click "Find Route".

Expected: button shows "Finding route…" briefly, then a dashed red line appears following real Jakarta streets between the two points, passing through the red Kampung Melayu flood polygon; hint text reads "Route found".

- [ ] **Step 6: Commit**

```bash
git add src/api/routeApi.js src/components/MapView.jsx src/App.jsx src/App.css
git commit -m "Fetch and render the normal OSRM route"
```

---

### Task 6: Safe-route detour and warning banner

**Files:**
- Create: `src/lib/safeRoute.js`
- Modify: `src/components/MapView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `findSafeRoute(start, end, normalGeometry, floodZones): Promise<GeoJSON LineString | null>` from `safeRoute.js`. Returns `normalGeometry` unchanged if it doesn't cross any flood zone; otherwise tries 4 via-point detours and returns the first collision-free result, or `null` if none avoid the flood zone.
- Consumes (safeRoute.js): `getRoute` from `src/api/routeApi.js` (Task 5).
- Consumes/Produces (MapView): new prop `safeRoute` (LineString or `null`), rendered as a solid teal Polyline, only drawn when it differs from `normalRoute`.
- Produces (App.jsx): state `safeRoute`, `noSafeRouteFound`; `handleFindRoute` now also calls `findSafeRoute`.

- [ ] **Step 1: Create `src/lib/safeRoute.js`**

```js
import * as turf from '@turf/turf'
import { getRoute } from '../api/routeApi.js'

const DETOUR_BUFFER_DEGREES = 0.003

function intersectsAnyFloodZone(lineGeometry, floodZones) {
  const line = turf.feature(lineGeometry)
  return floodZones.features.some((zone) => turf.booleanIntersects(line, zone))
}

function findIntersectingZone(lineGeometry, floodZones) {
  const line = turf.feature(lineGeometry)
  return floodZones.features.find((zone) => turf.booleanIntersects(line, zone))
}

function detourCandidates(zone) {
  const [minX, minY, maxX, maxY] = turf.bbox(zone)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const b = DETOUR_BUFFER_DEGREES

  return [
    { lat: maxY + b, lng: midX }, // north
    { lat: minY - b, lng: midX }, // south
    { lat: midY, lng: maxX + b }, // east
    { lat: midY, lng: minX - b }, // west
  ]
}

export async function findSafeRoute(start, end, normalGeometry, floodZones) {
  if (!intersectsAnyFloodZone(normalGeometry, floodZones)) {
    return normalGeometry
  }

  const zone = findIntersectingZone(normalGeometry, floodZones)
  const candidates = detourCandidates(zone)

  for (const viaPoint of candidates) {
    try {
      const candidateGeometry = await getRoute([start, viaPoint, end])
      if (!intersectsAnyFloodZone(candidateGeometry, floodZones)) {
        return candidateGeometry
      }
    } catch {
      // OSRM couldn't route through this via point (e.g. it's over water/inaccessible) — try the next one.
    }
  }

  return null
}
```

- [ ] **Step 2: Render the safe route in `MapView.jsx`**

Full file:

```jsx
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, useMapEvents } from 'react-leaflet'

export const JAKARTA_CENTER = [-6.2088, 106.8456]

const floodZoneStyle = () => ({
  color: '#FF4444',
  weight: 1,
  fillColor: '#FF4444',
  fillOpacity: 0.35,
})

function toLatLngs(lineGeometry) {
  return lineGeometry.coordinates.map(([lng, lat]) => [lat, lng])
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function MapView({
  floodZones,
  startPoint,
  endPoint,
  onMapClick,
  normalRoute,
  safeRoute,
}) {
  // findSafeRoute returns the SAME object reference as normalRoute when the
  // normal route never crossed a flood zone (no detour needed) — in that
  // case we draw only the teal line, not a redundant dashed-red one under it.
  const routeNeededDetour = normalRoute && safeRoute !== normalRoute
  const showNormalDashed = normalRoute && (routeNeededDetour || !safeRoute)
  const showSafeTeal = Boolean(safeRoute)

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
      {showNormalDashed && (
        <Polyline
          positions={toLatLngs(normalRoute)}
          pathOptions={{ color: '#FF4444', weight: 4, dashArray: '8, 8' }}
        />
      )}
      {showSafeTeal && (
        <Polyline
          positions={toLatLngs(safeRoute)}
          pathOptions={{ color: '#00E5A0', weight: 4 }}
        />
      )}
    </MapContainer>
  )
}

export default MapView
```

- [ ] **Step 3: Call `findSafeRoute` from `App.jsx`**

Full file:

```jsx
import { useEffect, useState } from 'react'
import './App.css'
import MapView from './components/MapView.jsx'
import { getFloodZones } from './api/floodApi.js'
import { getRoute } from './api/routeApi.js'
import { findSafeRoute } from './lib/safeRoute.js'

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
          {normalRoute && !noSafeRouteFound && 'Route found'}
        </span>
        {routeError && <span className="control-error">{routeError}</span>}
        {noSafeRouteFound && (
          <span className="control-warning">
            No flood-free route found — showing the direct route
          </span>
        )}
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
          safeRoute={safeRoute}
        />
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 4: Add warning styling to `App.css`**

Add to the end of `src/App.css`:

```css
.control-warning {
  font-size: 13px;
  color: #ffb84d;
}
```

- [ ] **Step 5: Verify in browser — happy path**

Run: `npm run dev`. Click start near `-6.2185, 106.8570` and end near `-6.2185, 106.8680` (crosses Kampung Melayu), click "Find Route".

Expected: dashed red line through the flood zone appears first, then a solid teal line appears tracing a visibly different path around the red polygon (not through it). Hint reads "Route found", no warning shown.

- [ ] **Step 6: Verify in browser — no-flood path**

Reset, click two points far from any flood polygon (e.g. both south of `-6.30`), click "Find Route".

Expected: only a solid teal line is drawn (no dashed red line, since the normal route already avoids all flood zones), no warning.

- [ ] **Step 7: Commit**

```bash
git add src/lib/safeRoute.js src/components/MapView.jsx src/App.jsx src/App.css
git commit -m "Add via-waypoint flood detour and safe-route rendering"
```

---

### Task 7: OSRM failure handling and final polish

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- No new interfaces — this task hardens existing error paths, no signature changes.

- [ ] **Step 1: Confirm `handleFindRoute`'s existing try/catch already covers OSRM failure**

Re-read `handleFindRoute` in `src/App.jsx` (written in Task 6, Step 3): both `getRoute` and `findSafeRoute` calls are inside the single `try` block, and `routeApi.js`'s `getRoute` already throws a descriptive `Error` on non-2xx responses or `code !== 'Ok'`. No code change needed here — this step is a verification checkpoint before the manual test below.

- [ ] **Step 2: Verify OSRM failure is handled gracefully**

Run: `npm run dev`. Temporarily edit `src/api/routeApi.js`'s `OSRM_BASE` constant to an invalid host (e.g. `https://router.invalid.test/route/v1/foot/`), save, click two points and "Find Route".

Expected: button returns to "Find Route" (not stuck on "Finding route…"), a red error message appears in the control bar (e.g. "Failed to fetch" or similar), no route is drawn, no unhandled promise rejection in the console.

- [ ] **Step 3: Revert the temporary change**

```bash
git checkout src/api/routeApi.js
```

Expected: `OSRM_BASE` is back to `https://router.project-osrm.org/route/v1/foot/`.

- [ ] **Step 4: Full end-to-end manual verification**

Run: `npm run dev`. Perform each of these in order in the browser:
1. Load the app — dark map, flood zones visible, no console errors.
2. Click start/end across Kampung Melayu — both dashed red (through flood) and solid teal (around flood) routes render, distinctly different paths.
3. Click "Reset" — both markers and both routes clear, hint resets to "Click the map to set your start point".
4. Click start/end somewhere with no nearby flood zone — only a solid teal route renders.
5. Click a third point after start+end are both set — start marker moves, end marker and any drawn routes clear.

Expected: all five behaviors match, confirming the full ARUS flow works end-to-end.

- [ ] **Step 5: Commit (only if Step 1 required any fix)**

If Step 1's re-read surfaced no needed change, there is nothing to commit for this task — the plan is complete after Task 6's commit. If any fix was made, commit it:

```bash
git add src/App.jsx
git commit -m "Harden OSRM failure handling"
```
