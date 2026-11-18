import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Fonts are bundled (no CDN) so the app looks identical fully offline
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-500.css'
import '@fontsource/lexend/latin-600.css'
import '@fontsource/noto-sans-tamil/tamil-400.css'
import '@fontsource/noto-sans-tamil/tamil-500.css'
import '@fontsource/noto-sans-tamil/tamil-600.css'
import './index.css'
import { initBrowserApiFallback } from './lib/browserFallback.js'

// Attach localStorage fallback only when running outside Electron (e.g., browser preview)
initBrowserApiFallback()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge safely (only present inside Electron)
if (window.ipcRenderer && typeof window.ipcRenderer.on === 'function') {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
}
