import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Initialise i18n before App renders so the first paint already uses the
// stored language preference. The module has side effects on import — no
// further setup needed at the call site.
import './lib/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
