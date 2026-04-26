import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root')!

const removeSplash = () => {
  const splash = document.getElementById('initial-splash')
  if (!splash) return
  splash.classList.add('fade-out')
  setTimeout(() => splash.remove(), 400)
}

const observer = new MutationObserver(() => {
  if (rootEl.children.length > 0) {
    observer.disconnect()
    removeSplash()
  }
})
observer.observe(rootEl, { childList: true })

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
