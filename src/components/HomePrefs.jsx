import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PREF_LABELS, usePrefs } from '../lib/prefs'

export default function HomePrefs() {
  const { session, refreshProfile } = useAuth()
  const prefs = usePrefs()
  const [error, setError] = useState('')

  async function toggle(key, value) {
    setError('')
    const { error } = await supabase.from('profiles').update({ home_prefs: { ...prefs, [key]: value } }).eq('id', session.user.id)
    if (error) return setError(error.message)
    await refreshProfile()
  }

  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-1 font-semibold">Página inicial</h2>
      <p className="mb-3 text-xs text-zinc-500">Escolha o que aparece no seu Dashboard. As estatísticas continuam completas aqui no Perfil.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PREF_LABELS.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={!!prefs[key]} onChange={(e) => toggle(key, e.target.checked)} /> {label}
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  )
}
