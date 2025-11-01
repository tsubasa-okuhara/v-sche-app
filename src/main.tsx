// src/main.tsx
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import AppTasks from './AppTasks'
import ClientReport from './ClientReport'

function Router() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // URL が #/report で始まっていたら帳票ページへ
  if (hash.startsWith('#/report')) return <ClientReport />

  // それ以外は既存のスケジュール画面
  return <AppTasks />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)