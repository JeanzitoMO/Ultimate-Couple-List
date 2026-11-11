import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Film, Star } from 'lucide-react'
import { getRecent, getTvEpisodes } from '../lib/api'

const CATS = [['movie', 'Filmes'], ['series', 'Séries'], ['anime', 'Animes'], ['cartoon', 'Desenhos']]
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5)

function Row({ item }) {
  const tmdbShow = item.source === 'tmdb' && item.type !== 'movie'
  const eps = useQuery({
    queryKey: ['eps', item.external_id], queryFn: () => getTvEpisodes(item.external_id),
    enabled: tmdbShow, staleTime: 3_600_000,
  })
  const sub = item.type === 'movie' ? 'Filme'
    : tmdbShow ? (eps.data ? `${eps.data} episódios` : eps.isLoading ? '…' : 'Em exibição')
    : item.episodes ? `${item.episodes} episódios` : 'Em exibição'
  return (
    <li className="flex gap-3 rounded-lg bg-zinc-900 p-2">
      {item.cover_url
        ? <img src={item.cover_url} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded object-cover" />
        : <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-zinc-800"><Film size={16} className="text-zinc-600" /></div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-zinc-500">{sub}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-yellow-400">
          <Star size={12} className="fill-yellow-400" /> {item.rating ? item.rating.toFixed(1) : '—'}
        </p>
      </div>
    </li>
  )
}

export default function RecentReleases() {
  const [tick, setTick] = useState(0)
  const [paused, setPaused] = useState(false)
  const queries = useQueries({
    queries: CATS.map(([c]) => ({ queryKey: ['recent', c], queryFn: () => getRecent(c), staleTime: 3_600_000 })),
  })

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setTick((x) => x + 1), 10_000)
    return () => clearTimeout(t)
  }, [tick, paused])

  const ci = tick % CATS.length
  const pool = queries[ci].data
  const picks = useMemo(() => (pool ? shuffle(pool).slice(0, 5) : []), [pool, tick])

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mb-3 flex gap-1">
        {CATS.map(([, label], i) => (
          <button key={label} onClick={() => setTick(i)}
            className={`rounded-full px-2.5 py-1 text-xs ${i === ci ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {queries[ci].isLoading && <p className="text-sm text-zinc-500">Carregando…</p>}
      {queries[ci].isError && <p className="text-sm text-red-400">Não foi possível carregar: {queries[ci].error?.message}</p>}
      {pool && !picks.length && <p className="text-sm text-zinc-500">{CATS[ci][0] === 'anime' ? 'Nenhum anime encontrado.' : 'Sem dados (confira a chave do TMDB).'}</p>}
      <ul key={`${ci}-${tick}`} className="space-y-2">{picks.map((it) => <Row key={`${it.source}:${it.external_id}`} item={it} />)}</ul>
      <p className="mt-2 text-[10px] text-zinc-600">Notas: TMDB (filmes, séries e desenhos) e MyAnimeList (animes). Troca a cada 10s; pausa ao passar o mouse.</p>
    </div>
  )
}
