// src/main.tsx
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';     // ベースUI（toolbarなど）
import './report.css';    // ← これを必ず後ろに（帳票デザインを上書き適用）

import AppTasks from './AppTasks';
import ClientReport from './ClientReport';

function Router() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 帳票URL (#/report...) のときは ClientReport を表示
  if (hash.startsWith('#/report')) return <ClientReport />;
  return <AppTasks />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>
);