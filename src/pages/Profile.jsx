import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import ListsPanel from '../components/ListsPanel'

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }
const MAX_BYTES = 2 * 1024 * 1024
const nickSchema = z.string().trim().min(2, 'Apelido muito curto').max(30, 'Apelido muito longo')

export default function Profile() {
  const { session, profile, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const [nick, setNick] = useState(profile?.nickname ?? '')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const members = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data
    },
  })
  const refresh = async () => { await refreshProfile(); qc.invalidateQueries({ queryKey: ['members'] }) }
  const ok = (text) => setMsg({ ok: true, text })
  const fail = (text) => setMsg({ ok: false, text })

  async function saveNick(e) {
    e.preventDefault()
    setMsg(null)
    const parsed = nickSchema.safeParse(nick)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    const { error } = await supabase.from('profiles').update({ nickname: parsed.data }).eq('id', session.user.id)
    if (error) return fail(error.message)
    await refresh()
    ok('Apelido atualizado.')
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(null)
    if (!ALLOWED[file.type]) return fail('Formato inválido. Use JPG, JPEG, PNG ou GIF.')
    if (file.size > MAX_BYTES) return fail('Imagem maior que 2 MB.')
    setBusy(true)
    const uid = session.user.id
    const path = `${uid}/avatar-${Date.now()}.${ALLOWED[file.type]}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
    if (upErr) { setBusy(false); return fail(upErr.message) }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', uid)
    if (error) { setBusy(false); return fail(error.message) }
    const old = profile?.avatar_url?.split('/avatars/')[1]
    if (old) await supabase.storage.from('avatars').remove([old])
    await refresh()
    setBusy(false)
    ok('Avatar atualizado.')
  }

  const approved = members.data ?? []
  const card = 'mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5'
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">Perfil</h1>

      <section className={card}>
        <div className="mb-4 flex items-center gap-3">
          <Avatar url={profile?.avatar_url} name={profile?.nickname} />
          <div>
            <p className="font-medium">{profile?.nickname}</p>
            <p className="text-xs text-zinc-500">{session.user.email}</p>
          </div>
        </div>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 ${busy ? 'opacity-50' : ''}`}>
          <Upload size={16} /> {busy ? 'Enviando…' : 'Trocar avatar'}
          <input type="file" accept="image/jpeg,image/png,image/gif" onChange={onAvatar} disabled={busy} className="hidden" />
        </label>
        <p className="mt-1 text-xs text-zinc-500">JPG, JPEG, PNG ou GIF · máx. 2 MB · exibido em 32×32</p>

        <form onSubmit={saveNick} className="mt-4 flex gap-2">
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={30} placeholder="Apelido"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          <button className="rounded-md bg-indigo-600 px-4 text-sm font-medium hover:bg-indigo-500">Salvar</button>
        </form>
        {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      </section>

      <ListsPanel />

      <section className={card}>
        <h2 className="mb-3 font-semibold">Você e seus parceiros</h2>
        <ul className="space-y-2">
          {approved.map((m) => (
            <li key={m.id} className="flex items-center gap-3 text-sm">
              <Avatar url={m.avatar_url} name={m.nickname} />
              <span>{m.nickname}</span>
              {m.role === 'admin' && <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">admin</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
