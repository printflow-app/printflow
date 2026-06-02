import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

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
