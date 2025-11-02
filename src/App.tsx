import { useEffect, useState } from 'react';
import AppTasks from './AppTasks';
import Records from './pages/Records';

export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#/');

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const route = (hash.startsWith('#') ? hash.slice(1) : hash) || '/';

  if (route.startsWith('/records') || route.startsWith('/report')) {
    return <Records />;
  }
  return <AppTasks />;
}