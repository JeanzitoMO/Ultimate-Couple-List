import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Film, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { searchTitles } from '../lib/api'
import { STATUS, TYPES } from '../lib/constants'
import MediaModal from '../components/MediaModal'
import ListSwitcher from '../components/ListSwitcher'
import ManualModal from '../components/ManualModal'
import { useLists } from '../context/ListContext'

function Poster({ item, status, onClick }) {
  return (
    <button onClick={onClick} className="group relative overflow-hidden rounded-lg bg-zinc-900 text-left transition hover:-translate-y-1 hover:ring-2 hover:ring-indigo-500">
      {item.cover_url
        ? <img src={item.cover_url} alt={item.title} loading="lazy" className="aspect-[2/3] w-full object-cover" />
        : <div className="flex aspect-[2/3] items-center justify-center bg-zinc-800"><Film className="text-zinc-600" /></div>}
      {status && (
        <span className={`absolute bottom-10 right-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS[status].color}`}>
          {STATUS[status].label}
        </span>
      )}
      <div className="p-2">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-zinc-500">{TYPES[item.type]}</p>
      </div>
    </button>
  )
}

export default function Catalog() {
  const { active, canEdit, error: listsError, loading: listsLoading } = useLists()
  const readOnly = !!active && !canEdit
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 400)
    return () => clearTimeout(t)
  }, [text])

  const mylist = useQuery({
    queryKey: ['mylist', active?.id], enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase.from('list_entries')
        .select('id, status, season, episode, updated_at, media(*), entry_ratings(user_id, rating, review, profiles!entry_ratings_user_id_fkey(nickname))')
        .eq('list_id', active.id).order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(({ media, entry_ratings, ...progress }) => ({ ...media, progress, ratings: entry_ratings }))
    },
  })

  const searching = q.length >= 2 && !readOnly
  const opts = (only) => ({ queryKey: ['search', only, q], queryFn: () => searchTitles(q, only), enabled: searching, staleTime: 300_000 })
  const tm = useQuery(opts('tmdb'))
  const jk = useQuery(opts('anime'))
  const results = { data: [...(tm.data ?? []), ...(jk.data ?? [])], isFetching: tm.isFetching || jk.isFetching }

  const mine = new Map((mylist.data ?? []).map((m) => [`${m.source}:${m.external_id}`, m]))
  const list = searching
    ? (results.data ?? []).filter((r) => type === 'all' || r.type === type)
        .map((r) => mine.get(`${r.source}:${r.external_id}`) ?? r)
    : (mylist.data ?? []).filter((m) => (type === 'all' || m.type === type) && (status === 'all' || m.progress.status === status))

  const pill = (active) => `rounded-full px-3 py-1 text-sm ${active ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Catálogo</h1>
        <ListSwitcher />
      </div>
      {!listsLoading && !active && (
        <p className="mb-4 rounded-md bg-red-950 p-3 text-sm text-red-300">
          Não foi possível carregar suas listas{listsError ? `: ${listsError.message}` : ''}. Sem uma lista ativa não dá para salvar títulos.
        </p>
      )}
      {!readOnly && <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar filmes, séries, animes e desenhos…"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
      </div>}
      {!readOnly && active && (
        <button onClick={() => setManual(true)} className="mb-4 text-sm text-indigo-400 hover:underline">
          + Não achou? Cadastrar manualmente
        </button>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <button onClick={() => setType('all')} className={pill(type === 'all')}>Tudo</button>
        {Object.entries(TYPES).map(([k, v]) => <button key={k} onClick={() => setType(k)} className={pill(type === k)}>{v}</button>)}
      </div>
      {!searching && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setStatus('all')} className={pill(status === 'all')}>Todos</button>
          {Object.entries(STATUS).map(([k, v]) => <button key={k} onClick={() => setStatus(k)} className={pill(status === k)}>{v.label}</button>)}
        </div>
      )}

      {(results.isFetching || mylist.isLoading) && <p className="text-sm text-zinc-500">Carregando…</p>}
      {!list.length && !results.isFetching && !mylist.isLoading && (
        <p className="text-sm text-zinc-500">{searching ? 'Nenhum resultado.' : 'Sua lista está vazia. Use a busca acima para adicionar títulos.'}</p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {list.map((item) => (
          <Poster key={`${item.source}:${item.external_id}`} item={item} status={item.progress?.status} onClick={() => setSelected(item)} />
        ))}
      </div>
      {manual && <ManualModal onClose={() => setManual(false)} onCreate={(it) => { setManual(false); setSelected(it) }} />}
      {selected && <MediaModal key={`${selected.source}:${selected.external_id}`} item={selected} listId={active?.id} readOnly={readOnly} onClose={() => setSelected(null)} />}
    </>
  )
}
