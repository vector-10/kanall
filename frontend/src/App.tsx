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
import SettingsPage from './pages/SettingsPage'
import { api } from './api'

function DashboardLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <Layout onLogout={onLogout}>
      <Outlet />
    </Layout>
  )
}

function AppRoutes() {
  const queryClient = useQueryClient()

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const isAuthed = !!me

  const handleAuthSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } finally {
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
          <Route path="/settings" element={<SettingsPage />} />
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
