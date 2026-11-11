import { useState } from 'react'
import { X } from 'lucide-react'
import { z } from 'zod'
import { TYPES } from '../lib/constants'

const schema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(200, 'Título muito longo'),
  type: z.enum(['movie', 'series', 'anime', 'cartoon']),
  cover_url: z.string().trim().refine((v) => v === '' || /^https?:\/\//i.test(v), 'A capa deve ser um link http(s)'),
  platform: z.string().trim().max(60, 'Plataforma muito longa'),
  total_seasons: z.coerce.number().int().min(0).max(100),
  total_episodes: z.coerce.number().int().min(0).max(10000),
  runtime_minutes: z.coerce.number().int().min(0).max(1000),
})

export default function ManualModal({ onCreate, onClose }) {
  const [error, setError] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    setError('')
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    const f = parsed.data
    const movie = f.type === 'movie'
    onCreate({
      source: 'manual', external_id: crypto.randomUUID(), title: f.title, type: f.type,
      cover_url: f.cover_url || null, synopsis: null, platform: f.platform || null,
      total_seasons: movie ? null : f.total_seasons || null,
      total_episodes: movie ? null : f.total_episodes || null,
      runtime_minutes: f.runtime_minutes || null,
    })
  }

  const field = 'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Cadastrar manualmente</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="block text-sm">Título
          <input name="title" maxLength={200} className={field} autoFocus />
        </label>
        <label className="block text-sm">Tipo
          <select name="type" defaultValue="series" className={field}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block text-sm">Capa (link da imagem, opcional)
          <input name="cover_url" placeholder="https://..." className={field} />
        </label>
        <label className="block text-sm">Plataforma (opcional)
          <input name="platform" maxLength={60} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Temporadas
            <input name="total_seasons" type="number" min="0" defaultValue="0" className={field} />
          </label>
          <label className="text-sm">Episódios
            <input name="total_episodes" type="number" min="0" defaultValue="0" className={field} />
          </label>
        </div>
        <label className="block text-sm">Duração em minutos (do filme ou de cada episódio, opcional)
          <input name="runtime_minutes" type="number" min="0" defaultValue="0" className={field} />
        </label>
        <p className="text-xs text-zinc-500">Temporadas e episódios são ignorados para filmes.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500">Continuar</button>
      </form>
    </div>
  )
}
