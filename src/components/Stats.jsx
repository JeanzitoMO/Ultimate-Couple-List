import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getDetails } from '../lib/api'
import { STATUS } from '../lib/constants'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function Card({ value, label }) {
  return (
    <div className="rounded-lg bg-zinc-900 p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}

// listIds: listas consideradas | show: 'all' ou lista de ids (status, year, hours, episodes, monthly)
export default function Stats({ listIds = [], show = 'all' }) {
  const qc = useQueryClient()
  const tried = useRef(new Set())
  const has = (id) => show === 'all' || show.includes(id)
  const needRuntime = has('hours')
  const key = listIds.join()

  const q = useQuery({
    queryKey: ['stats', key], enabled: listIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('list_entries')
        .select('media_id, status, season, episode, updated_at, media(id, type, source, external_id, runtime_minutes, total_episodes, total_seasons)')
        .in('list_id', listIds).limit(5000)
      if (error) throw error
      return data
    },
  })

  // Um mesmo título em várias listas conta uma vez (vale o registro mais recente)
  const byMedia = new Map()
  for (const r of q.data ?? []) {
    const p = byMedia.get(r.media_id)
    if (!p || new Date(r.updated_at) > new Date(p.updated_at)) byMedia.set(r.media_id, r)
  }
  const items = [...byMedia.values()]

  // Busca a duração de títulos antigos que ainda não a têm (poucos por vez)
  useEffect(() => {
    if (!needRuntime || !q.data) return
    const missing = [...new Map(items.filter((r) => r.media && !r.media.runtime_minutes && r.media.source !== 'manual')
      .map((r) => [r.media.id, r.media])).values()].filter((m) => !tried.current.has(m.id)).slice(0, 12)
    if (!missing.length) return
    ;(async () => {
      for (const m of missing) {
        tried.current.add(m.id)
        try {
          const d = await getDetails(m)
          if (d.runtime_minutes) await supabase.rpc('set_media_runtime', { mid: m.id, mins: d.runtime_minutes })
        } catch { /* tenta de novo em outra visita */ }
      }
      qc.invalidateQueries({ queryKey: ['stats'] })
    })()
  }, [q.data, needRuntime]) // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isError) return <p className="text-sm text-red-400">Não foi possível carregar as estatísticas.</p>

  const year = new Date().getFullYear()
  const count = (k) => items.filter((r) => r.status === k).length
  const doneYear = items.filter((r) => r.status === 'completed' && new Date(r.updated_at).getFullYear() === year)
  const movies = doneYear.filter((r) => r.media?.type === 'movie').length
  const months = MONTHS.map((_, i) => doneYear.filter((r) => new Date(r.updated_at).getMonth() === i).length)
  const max = Math.max(1, ...months)

  let minutes = 0, episodes = 0, missing = 0
  for (const r of items) {
    const m = r.media
    if (!m) continue
    if (m.type === 'movie') {
      if (r.status === 'completed') { if (m.runtime_minutes) minutes += m.runtime_minutes; else missing++ }
      continue
    }
    if (r.status === 'want') continue
    const total = m.total_episodes
    let eps = r.episode
    if (r.status === 'completed') eps = total ?? r.episode
    else if (r.season > 1 && total && m.total_seasons) eps = Math.round(r.episode + ((r.season - 1) * total) / m.total_seasons)
    if (total) eps = Math.min(eps, total)
    episodes += eps
    if (eps > 0) { if (m.runtime_minutes) minutes += eps * m.runtime_minutes; else missing++ }
  }
  const hours = minutes / 60
  const hoursText = `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} h`
  const v = (n) => (q.isLoading ? '–' : n)

  return (
    <div className="space-y-3">
      {has('status') && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(STATUS).map(([k, s]) => (
            <div key={k} className="rounded-lg bg-zinc-900 p-3">
              <span className={`inline-block h-2 w-2 rounded-full ${s.color.split(' ')[0]}`} />
              <p className="mt-1 text-2xl font-bold">{v(count(k))}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {(has('year') || has('hours') || has('episodes')) && (
        <div className="grid grid-cols-2 gap-3">
          {has('year') && <Card value={v(movies)} label={`Filmes finalizados em ${year}`} />}
          {has('year') && <Card value={v(doneYear.length - movies)} label={`Séries, animes e desenhos finalizados em ${year}`} />}
          {has('hours') && <Card value={v(hoursText)} label="Horas assistidas (estimativa)" />}
          {has('episodes') && <Card value={v(episodes)} label="Episódios assistidos (estimativa)" />}
        </div>
      )}

      {has('monthly') && (
        <div className="rounded-lg bg-zinc-900 p-3">
          <p className="mb-2 text-xs text-zinc-400">Finalizados por mês em {year}</p>
          <div className="flex h-28 items-end gap-1">
            {months.map((n, i) => (
              <div key={MONTHS[i]} className="flex h-full flex-1 flex-col items-center justify-end">
                {n > 0 && <span className="mb-0.5 text-[10px] text-zinc-400">{n}</span>}
                <div style={{ height: `${(n / max) * 80}%` }} className={`min-h-[2px] w-full rounded-t ${n ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
                <span className="mt-1 text-[10px] text-zinc-500">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {show === 'all' && (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Horas e episódios são estimativas calculadas a partir do progresso salvo (em séries com várias temporadas, o total por temporada é uma média).
          {missing > 0 && ` ${missing} título(s) ainda sem duração conhecida não entram na conta; ela é buscada automaticamente ao abrir esta tela.`}
          {' '}Os meses usam a data da última atualização de cada título.
        </p>
      )}
    </div>
  )
}
