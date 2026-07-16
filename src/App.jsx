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
