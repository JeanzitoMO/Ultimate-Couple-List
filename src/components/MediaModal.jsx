import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, X } from 'lucide-react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { getDetails } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { STATUS, TYPES } from '../lib/constants'

const schema = z.object({
  status: z.enum(['want', 'watching', 'completed', 'dropped']),
  season: z.coerce.number().int().min(1),
  episode: z.coerce.number().int().min(0),
  rating: z.number().min(0).max(5),
  review: z.string().max(500, 'Review: máximo de 500 caracteres'),
})

export default function MediaModal({ item, listId, readOnly, onClose }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const p = item.progress
  const mine = item.ratings?.find((r) => r.user_id === session.user.id)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [error, setError] = useState('')

  const details = useQuery({
    queryKey: ['details', item.source, item.external_id],
    queryFn: () => getDetails(item),
    enabled: !!item.fromSearch,
    staleTime: 600_000,
  })
  const info = { ...item, ...(details.data ?? {}) }
  const isMovie = info.type === 'movie'

  const save = useMutation({
    mutationFn: async (f) => {
      const row = {
        source: info.source, external_id: info.external_id, title: info.title, type: info.type,
        cover_url: info.cover_url, synopsis: info.synopsis, platform: info.platform ?? null,
        total_seasons: info.total_seasons ?? null, total_episodes: info.total_episodes ?? null,
      }
      const { error: e0 } = await supabase.from('media').upsert(row, { onConflict: 'source,external_id', ignoreDuplicates: true })
      if (e0) throw e0
      const { data: m, error: e1 } = await supabase.from('media').select('id')
        .eq('source', info.source).eq('external_id', info.external_id).single()
      if (e1) throw e1
      const { data: en, error: e2 } = await supabase.from('list_entries').upsert({
        list_id: listId, media_id: m.id, status: f.status,
        season: isMovie ? 1 : f.season, episode: isMovie ? 0 : f.episode, updated_by: session.user.id,
      }, { onConflict: 'list_id,media_id' }).select('id').single()
      if (e2) throw e2
      const { error: e3 } = await supabase.from('entry_ratings').upsert({
        entry_id: en.id, user_id: session.user.id, rating: f.rating || null, review: f.review || null,
      }, { onConflict: 'entry_id,user_id' })
      if (e3) throw e3
    },
    onSuccess: () => {
      ['mylist', 'watching', 'activity', 'stats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('list_entries').delete().eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      ['mylist', 'watching', 'activity', 'stats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  function onSubmit(e) {
    e.preventDefault()
    setError('')
    const fd = Object.fromEntries(new FormData(e.currentTarget))
    const parsed = schema.safeParse({ ...fd, rating, review: fd.review ?? '' })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    save.mutate(parsed.data)
  }

  const field = 'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex gap-4">
          {info.cover_url && <img src={info.cover_url} alt="" className="w-24 rounded-md object-cover" />}
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2">
              <h2 className="text-lg font-semibold">{info.title}</h2>
              <button type="button" onClick={onClose}><X size={18} /></button>
            </div>
            <p className="text-sm text-zinc-400">
              {TYPES[info.type]}
              {!isMovie && info.total_episodes ? ` · ${info.total_seasons ?? '?'} temp. · ${info.total_episodes} ep.` : ''}
            </p>
            <p className="text-sm text-zinc-400">{details.isLoading ? 'Buscando detalhes…' : info.platform ?? 'Plataforma não informada'}</p>
            {info.synopsis && <p className="mt-2 line-clamp-3 text-xs text-zinc-500">{info.synopsis}</p>}
          </div>
        </div>

        <fieldset disabled={readOnly} className="space-y-4">
        <label className="block text-sm">Status
          <select name="status" defaultValue={p?.status ?? 'want'} className={field}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>

        {!isMovie && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Temporada
              <input name="season" type="number" min="1" defaultValue={p?.season ?? 1} className={field} />
            </label>
            <label className="text-sm">Episódio atual{info.total_episodes ? ` (de ${info.total_episodes})` : ''}
              <input name="episode" type="number" min="0" defaultValue={p?.episode ?? 0} className={field} />
            </label>
          </div>
        )}

        <div>
          <p className="mb-1 text-sm">Nota</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRating(rating === n ? 0 : n)}>
                <Star size={24} className={n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600'} />
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">Review curta
          <textarea name="review" rows="3" maxLength={500} defaultValue={mine?.review ?? ''} className={field} />
        </label>

        </fieldset>

        {item.ratings?.filter((r) => r.user_id !== session.user.id && (r.rating || r.review)).map((r) => (
          <p key={r.user_id} className="text-sm text-zinc-400">
            <b>{r.profiles?.nickname}</b>: {r.rating ? '★'.repeat(Math.round(r.rating)) : ''} {r.review}
          </p>
        ))}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {!readOnly && <button disabled={save.isPending} className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </button>}
        {p && !readOnly && (
          <button type="button" disabled={remove.isPending}
            onClick={() => window.confirm('Remover este título da lista? As notas dadas a ele nesta lista também serão apagadas.') && remove.mutate()}
            className="w-full text-sm text-red-400 hover:underline">
            Remover da lista
          </button>
        )}
      </form>
    </div>
  )
}
