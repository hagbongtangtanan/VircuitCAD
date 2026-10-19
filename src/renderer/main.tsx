import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './ui/styles.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Renderer bootstrap failed: no #root element in index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
