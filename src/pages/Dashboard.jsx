import { useQuery } from '@tanstack/react-query'
import { Eye, CheckCircle2, Film } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import RecentReleases from '../components/RecentReleases'
import ListSwitcher from '../components/ListSwitcher'
import Stats from '../components/Stats'
import { usePrefs } from '../lib/prefs'
import { useLists } from '../context/ListContext'

const STATUS_COLOR = { watching: 'bg-blue-500', completed: 'bg-green-500', dropped: 'bg-red-500', want: 'bg-yellow-500' }

function useWatching(listId) {
  return useQuery({
    queryKey: ['watching', listId], enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_entries')
        .select('id, season, episode, updated_at, media(title, cover_url, type)')
        .eq('list_id', listId).eq('status', 'watching').order('updated_at', { ascending: false }).limit(5)
      if (error) throw error
      return data
    },
  })
}

function useActivity(listId) {
  return useQuery({
    queryKey: ['activity', listId], enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_entries')
        .select('id, status, season, episode, updated_at, profiles!list_entries_updated_by_fkey(nickname), media(title, type)')
        .eq('list_id', listId).order('updated_at', { ascending: false }).limit(10)
      if (error) throw error
      return data
    },
  })
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { active } = useLists()
  const prefs = usePrefs()
  const statIds = ['status', 'year', 'hours', 'episodes', 'monthly'].filter((id) => prefs[`stat_${id}`])
  const listId = active?.id
  const watching = useWatching(listId)
  const activity = useActivity(listId)

  return (
    <>


      <div className="grid gap-8 md:grid-cols-3">
        <div className={prefs.releases ? 'md:col-span-2' : 'md:col-span-3'}>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Olá, {profile?.nickname ?? 'bem-vindo'} 👋</h1>
        <ListSwitcher />
      </div>

      {prefs.watching && (
<Section title="Últimos assistidos">
        {watching.data?.length ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {watching.data.map((w) => (
              <article key={w.id} className="w-32 shrink-0 transition hover:-translate-y-1 hover:ring-2 hover:ring-indigo-500 rounded-lg overflow-hidden bg-zinc-900">
                {w.media?.cover_url
                  ? <img src={w.media.cover_url} alt={w.media.title} className="aspect-[2/3] w-full object-cover" />
                  : <div className="flex aspect-[2/3] items-center justify-center bg-zinc-800"><Film className="text-zinc-600" /></div>}
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{w.media?.title}</p>
                  <p className="text-xs text-zinc-500">{w.media?.type === 'movie' ? 'Filme' : `T${w.season} · Ep ${w.episode}`}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-zinc-500">Nada em andamento ainda.</p>}
      </Section>
)}
          {prefs.activity && (
<Section title="Atividade recente">
            <ul className="space-y-2 border-l border-zinc-800 pl-4">
              {activity.data?.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_COLOR[a.status]}`} />
                  <b>{a.profiles?.nickname}</b> atualizou <i>{a.media?.title}</i>
                  {a.media?.type !== 'movie' && ` (T${a.season} Ep ${a.episode})`}
                </li>
              )) ?? null}
              {activity.data?.length === 0 && <p className="text-zinc-500">Sem atividades.</p>}
            </ul>
          </Section>
)}
          {statIds.length > 0 && (
<Section title="Estatísticas rápidas">
            <Stats listIds={listId ? [listId] : []} show={statIds} />
          </Section>
)}
        </div>

        {prefs.releases && (
<aside>
          <Section title="Novidades no mundo">
            <RecentReleases />
          </Section>
        </aside>
)}
      </div>
    </>
  )
}
