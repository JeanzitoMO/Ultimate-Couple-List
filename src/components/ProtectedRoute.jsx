import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="p-10 text-center text-zinc-400">Carregando…</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}
