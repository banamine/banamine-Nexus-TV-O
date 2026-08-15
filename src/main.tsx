import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { preConfigureLocalStorage } from './utils/playlistBridge.ts';

// Pre-configure localStorage parameters prior to DOM hydration
preConfigureLocalStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

