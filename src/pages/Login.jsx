import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
})

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    const { error } = await signIn(parsed.data.email, parsed.data.password)
    setBusy(false)
    if (error) return setError('E-mail ou senha incorretos')
    navigate(location.state?.from?.pathname ?? '/', { replace: true })
  }

  const input = 'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500'
  return (
    <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h1 className="text-xl font-semibold">Entrar</h1>
      <input name="email" type="email" placeholder="E-mail" className={input} autoComplete="email" />
      <input name="password" type="password" placeholder="Senha" className={input} autoComplete="current-password" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={busy} className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-center text-xs text-zinc-500">Sem conta? <Link to="/signup" className="text-indigo-400">Sign Up</Link></p>
    </form>
  )
}
