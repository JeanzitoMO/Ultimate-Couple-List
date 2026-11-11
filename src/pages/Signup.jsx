import { useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'

const schema = z.object({
  nickname: z.string().trim().min(2, 'Apelido muito curto').max(30, 'Apelido muito longo'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
})

export default function Signup() {
  const { signUp } = useAuth()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    const { nickname, email, password } = parsed.data
    const { error } = await signUp(email, password, nickname)
    if (error) return setError(error.message)
    setDone(true)
  }

  const input = 'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500'
  if (done) return <p className="mt-10 text-center text-zinc-300">Conta criada! Se for exigido, confirme seu e-mail antes de entrar.</p>
  return (
    <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h1 className="text-xl font-semibold">Criar conta</h1>
      <input name="nickname" placeholder="Apelido" className={input} />
      <input name="email" type="email" placeholder="E-mail" className={input} autoComplete="email" />
      <input name="password" type="password" placeholder="Senha" className={input} autoComplete="new-password" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500">Cadastrar</button>
      <p className="text-center text-xs text-zinc-500">Já tem conta? <Link to="/login" className="text-indigo-400">Login</Link></p>
    </form>
  )
}
