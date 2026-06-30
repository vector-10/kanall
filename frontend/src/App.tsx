import { Outlet, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import AccountsPage from './pages/AccountsPage'
import AccountDetailPage from './pages/AccountDetailPage'
import StatementPage from './pages/StatementPage'
import DeadLettersPage from './pages/DeadLettersPage'
import { api } from './api'

function DashboardLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <Layout onLogout={onLogout}>
      <Outlet />
    </Layout>
  )
}

// Separated from App so hooks can access the QueryClient provided by main.tsx
function AppRoutes() {
  const queryClient = useQueryClient()

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
    retry: false,           // never retry a 401 — it's not a transient error
    staleTime: 5 * 60_000,  // recheck auth at most every 5 minutes
  })

  const isAuthed = !!me

  const handleAuthSuccess = () => {
    // Cookie was set by the server. Invalidating ['me'] triggers a re-fetch
    // which will succeed, flipping isAuthed → true and redirecting via route guard.
    queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } finally {
      // Always clear local cache, even if the network call fails.
      // Prevents stale data from leaking into the next session.
      queryClient.clear()
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          background: '#0D0D0D',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'Bungee Inline', sans-serif",
            fontSize: 16,
            letterSpacing: '0.06em',
            color: '#1A1A1A',
          }}
        >
          KANALL
        </span>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage isAuthed={isAuthed} />} />

      <Route
        path="/register"
        element={
          isAuthed
            ? <Navigate to="/accounts" replace />
            : <RegisterPage onRegister={handleAuthSuccess} />
        }
      />

      <Route
        path="/login"
        element={
          isAuthed
            ? <Navigate to="/accounts" replace />
            : <LoginPage onLogin={handleAuthSuccess} />
        }
      />

      {isAuthed ? (
        <Route element={<DashboardLayout onLogout={handleLogout} />}>
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:accountRef" element={<AccountDetailPage />} />
          <Route path="/accounts/:accountRef/statement" element={<StatementPage />} />
          <Route path="/dead-letters" element={<DeadLettersPage />} />
          <Route path="*" element={<Navigate to="/accounts" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
