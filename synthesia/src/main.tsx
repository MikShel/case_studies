import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStoreProvider } from './store/AppStore';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </StrictMode>,
);
