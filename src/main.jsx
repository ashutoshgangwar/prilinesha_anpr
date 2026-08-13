// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SkeletonProvider } from './components/Skeletons';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* One place to set the placeholder colours every screen loads with. */}
    <SkeletonProvider>
      <App />
    </SkeletonProvider>
  </StrictMode>
);
