import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppTasks from './AppTasks';  // ← ここ変更

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppTasks />
  </StrictMode>,
);
