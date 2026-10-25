import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyStoredTheme } from './store/themeStore'
import './ui/tokens.css'
import './ui/styles.css'

applyStoredTheme()

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Renderer bootstrap failed: no #root element in index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
