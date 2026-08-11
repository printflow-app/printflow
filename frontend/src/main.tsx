import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// After a deploy, a client still running the previous build requests chunk hashes
// that no longer exist on the CDN, so the lazy import fails ("Failed to fetch
// dynamically imported module"). Vite fires 'vite:preloadError' in that case —
// reload once to pull the fresh index.html and its new hashes. Guard with a short
// sessionStorage window so a genuinely broken chunk can't loop the page forever.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'pf_chunk_reload_at'
  const last = Number(sessionStorage.getItem(KEY) || 0)
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()))
    window.location.reload()
  }
})

// Single QueryClient instance for the whole app. Tuned for B2B dashboards
// where data changes server-side but not millisecond-frequently.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // fresh for 30s; tab switches within that window hit cache
      gcTime:    5 * 60_000,    // unused cache lives for 5min (was cacheTime in v4)
      refetchOnWindowFocus: false,  // dashboard users don't expect refetch on focus
      // Retry/backoff (incl. 429 rate-limit) is handled centrally in the axios
      // interceptor (api/index.ts), so RQ must not retry on top of it — otherwise
      // a persistent failure would multiply into many attempts and add load.
      retry: 0,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
