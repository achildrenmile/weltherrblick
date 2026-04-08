import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/300.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import App from './App'

// Minimal global styles — no Tailwind, no CSS that could interfere with Cesium
const style = document.createElement('style')
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
  .cesium-viewer-bottom, .cesium-viewer-animationContainer, .cesium-viewer-timelineContainer,
  .cesium-viewer-fullscreenContainer, .cesium-viewer-vrContainer, .cesium-viewer-geocoderContainer,
  .cesium-viewer-toolbar, .cesium-viewer-selectionIndicator,
  .cesium-credit-logoContainer, .cesium-credit-textContainer,
  .cesium-performanceDisplay-defaultContainer { display: none !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,255,65,0.3); border-radius: 2px; }
  select, button, input { font-family: 'JetBrains Mono', monospace; }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
  @keyframes poiSlideIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)
