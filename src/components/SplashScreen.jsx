function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-ripples">
        <span className="splash-ripple" />
        <span className="splash-ripple" />
        <span className="splash-ripple" />
      </div>
      <img src="/logo.svg" alt="ARUS" className="splash-logo" />
      <h1 className="splash-wordmark">ARUS</h1>
      <span className="splash-tagline">URBAN SURVIVAL SYSTEM // JKT</span>
    </div>
  )
}

export default SplashScreen
