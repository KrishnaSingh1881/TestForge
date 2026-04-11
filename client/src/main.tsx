import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/ToastContainer';
import { applyPersistedSettings } from './os/store/useOSSettings';
import './index.css';
import App from './App';

applyPersistedSettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
