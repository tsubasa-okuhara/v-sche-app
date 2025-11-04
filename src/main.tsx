// src/main.tsx
import './style-records.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppTasks from './AppTasks';
import ClientReport from './ClientReport';

function Router() {
  const [hash, setHash] = React.useState(window.location.hash);
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash.startsWith('#/report')) return <ClientReport />;     // ← 帳票
  if (hash.startsWith('#/records')) return <ClientReport />;    // 互換: /records でもOK
  return <AppTasks />;                                          // 既存の予定/記録画面
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);