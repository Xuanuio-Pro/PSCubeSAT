import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { SerialProvider } from './contexts/SerialContext'
import { AuthProvider } from './contexts/AuthContext'
import { TelemetryProvider } from './contexts/TelemetryContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <SerialProvider>
        <TelemetryProvider><App /></TelemetryProvider>
      </SerialProvider>
    </AuthProvider>
  </BrowserRouter>
)
