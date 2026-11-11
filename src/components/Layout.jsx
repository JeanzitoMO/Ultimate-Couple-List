import { Link, Outlet } from 'react-router-dom'
import { Clapperboard, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

function Navbar() {
  const { session, profile, signOut } = useAuth()
  const btn = 'rounded-md px-3 py-1.5 text-sm font-medium transition'
  return (
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Clapperboard size={20} className="text-indigo-400" /> Nossa Watchlist
        </Link>
        <div className="flex items-center gap-2">
          {session && <Link to="/catalogo" className={`${btn} text-zinc-300 hover:bg-zinc-800`}>Catálogo</Link>}
          {session && <Link to="/perfil" title="Perfil" className="rounded-full ring-offset-2 ring-offset-zinc-900 hover:ring-2 hover:ring-indigo-500"><Avatar url={profile?.avatar_url} name={profile?.nickname} /></Link>}
          {session ? (
            <button onClick={signOut} className={`${btn} flex items-center gap-1 text-zinc-300 hover:bg-zinc-800`}>
              <LogOut size={16} /> Sair
            </button>
          ) : (
            <>
              <Link to="/login" className={`${btn} text-zinc-300 hover:bg-zinc-800`}>Login</Link>
              <Link to="/signup" className={`${btn} bg-indigo-600 text-white hover:bg-indigo-500`}>Sign Up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
      <p>© {new Date().getFullYear()} Absolas. Todos os direitos reservados.</p>
      <p className="mt-1">Nossa Watchlist v0.1 · Uso privado · Desenvolvido com React e Supabase</p>
    </footer>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
