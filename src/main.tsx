import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const setAppHeight = () => {
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}

setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)
window.visualViewport?.addEventListener('resize', setAppHeight)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
