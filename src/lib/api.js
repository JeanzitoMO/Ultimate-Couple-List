const TMDB = 'https://api.themoviedb.org/3'
const KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG = 'https://image.tmdb.org/t/p/w342'
const JIKAN = 'https://api.jikan.moe/v4' // legado (títulos salvos antes da v0.4)
const ANILIST = 'https://graphql.anilist.co'

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Erro ${res.status} ao consultar a API`)
  return res.json()
}

async function anilist(query, variables) {
  const res = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`AniList ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data
}

const clean = (t) => (t ? t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : null)
const FIELDS = 'id title { romaji english } coverImage { large } description episodes averageScore'
const fromAnilist = (m) => ({
  source: 'anilist', external_id: String(m.id), title: m.title.english ?? m.title.romaji, type: 'anime',
  cover_url: m.coverImage?.large ?? null, synopsis: clean(m.description),
  rating: m.averageScore ? m.averageScore / 10 : null, episodes: m.episodes ?? null,
})

// only: 'tmdb' | 'anime' | undefined (ambos)
export async function searchTitles(q, only) {
  const query = encodeURIComponent(q)
  const [tmdb, ani] = await Promise.allSettled([
    KEY && only !== 'anime' ? getJson(`${TMDB}/search/multi?api_key=${KEY}&language=pt-BR&query=${query}`) : Promise.resolve({ results: [] }),
    only !== 'tmdb'
      ? anilist(`query($q:String){ Page(perPage:10){ media(search:$q, type:ANIME, isAdult:false, sort:SEARCH_MATCH){ ${FIELDS} } } }`, { q })
      : Promise.resolve({ Page: { media: [] } }),
  ])
  if (ani.status === 'rejected') console.warn('Busca de animes falhou:', ani.reason)
  const out = []
  if (tmdb.status === 'fulfilled') {
    for (const r of tmdb.value.results) {
      if (r.media_type !== 'movie' && r.media_type !== 'tv') continue
      const animation = r.genre_ids?.includes(16)
      if (animation && r.original_language === 'ja') continue // animes vêm da AniList
      out.push({
        source: 'tmdb', external_id: `${r.media_type}:${r.id}`, title: r.title ?? r.name,
        type: r.media_type === 'movie' ? 'movie' : animation ? 'cartoon' : 'series',
        cover_url: r.poster_path ? IMG + r.poster_path : null, synopsis: r.overview || null, fromSearch: true,
      })
    }
  }
  if (ani.status === 'fulfilled') {
    for (const m of ani.value.Page.media) out.push({ ...fromAnilist(m), fromSearch: true })
  }
  return out
}

export async function getDetails(item) {
  if (item.source === 'tmdb') {
    const [kind, id] = item.external_id.split(':')
    const [d, p] = await Promise.all([
      getJson(`${TMDB}/${kind}/${id}?api_key=${KEY}&language=pt-BR`),
      getJson(`${TMDB}/${kind}/${id}/watch/providers?api_key=${KEY}`).catch(() => null),
    ])
    return {
      total_seasons: d.number_of_seasons ?? null, total_episodes: d.number_of_episodes ?? null,
      runtime_minutes: d.runtime ?? d.episode_run_time?.[0] ?? d.last_episode_to_air?.runtime ?? null,
      platform: p?.results?.BR?.flatrate?.[0]?.provider_name ?? d.networks?.[0]?.name ?? null,
    }
  }
  if (item.source === 'anilist') {
    const d = await anilist(
      'query($id:Int){ Media(id:$id, type:ANIME){ episodes duration externalLinks { site type } } }',
      { id: Number(item.external_id) },
    )
    const stream = d.Media.externalLinks?.find((l) => l.type === 'STREAMING')
    return { total_seasons: 1, total_episodes: d.Media.episodes ?? null, runtime_minutes: d.Media.duration ?? null, platform: stream?.site ?? null }
  }
  const d = await getJson(`${JIKAN}/anime/${item.external_id}`)
  return { total_seasons: 1, total_episodes: d.data.episodes ?? null, platform: null }
}

// ---------- Lançamentos recentes (painel do Dashboard) ----------
const isoDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

function fromTmdb(r, type, kind) {
  return {
    source: 'tmdb', external_id: `${kind}:${r.id}`, title: r.title ?? r.name, type,
    cover_url: r.poster_path ? IMG + r.poster_path : null,
    rating: r.vote_average > 0 && r.vote_count >= 5 ? r.vote_average : null,
  }
}

async function discover(kind, extra) {
  const base = `${TMDB}/discover/${kind}?api_key=${KEY}&language=pt-BR&sort_by=popularity.desc&${extra}`
  const pages = await Promise.all([1, 2, 3].map((p) => getJson(`${base}&page=${p}`).catch(() => ({ results: [] }))))
  return pages.flatMap((p) => p.results)
}

export async function getRecent(category) {
  if (category === 'anime') {
    const page = (filter, decl = '') =>
      `query${decl}{ Page(perPage:30){ media(type:ANIME, isAdult:false, sort:POPULARITY_DESC, ${filter}){ ${FIELDS} } } }`
    let d = await anilist(page('startDate_greater:$d', '($d:FuzzyDateInt)'), { d: Number(isoDay(-120).replace(/-/g, '')) })
    if (!d.Page.media.length) d = await anilist(page('status:RELEASING'), {})
    return d.Page.media.map(fromAnilist)
  }
  if (!KEY) return []
  const from = isoDay(-90), to = isoDay(0)
  if (category === 'movie') {
    const r = await discover('movie', `primary_release_date.gte=${from}&primary_release_date.lte=${to}`)
    return r.slice(0, 30).map((x) => fromTmdb(x, 'movie', 'movie'))
  }
  if (category === 'series') {
    const r = await discover('tv', `first_air_date.gte=${from}&first_air_date.lte=${to}&without_genres=16`)
    return r.slice(0, 30).map((x) => fromTmdb(x, 'series', 'tv'))
  }
  const r = await discover('tv', `first_air_date.gte=${from}&first_air_date.lte=${to}&with_genres=16`)
  return r.filter((x) => x.original_language !== 'ja').slice(0, 30).map((x) => fromTmdb(x, 'cartoon', 'tv'))
}

export async function getTvEpisodes(externalId) {
  const id = externalId.split(':')[1]
  const d = await getJson(`${TMDB}/tv/${id}?api_key=${KEY}`)
  return d.number_of_episodes ?? null
}
