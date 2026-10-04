import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import './b8f-component-selector';
import './b8f-component-selector.css';

// Load ByteFlow configuration (automatically generated during project creation)
// The config file exports BYTEFLOW_CONFIG with project IDs, WebSocket URL, and workflow data
try {
  // @ts-ignore - File is generated during project creation
  await import('./config/byteflow');
} catch {
  // Config not available - running in development mode without ByteFlow
  console.debug('ByteFlow config not found - WebSocket features disabled');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
