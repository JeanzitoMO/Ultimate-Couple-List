import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLists } from '../context/ListContext'

export default function ListsPanel() {
  const { session } = useAuth()
  const { lists, choose } = useLists()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState({})
  const [msg, setMsg] = useState(null)
  const me = session.user.id
  const personal = lists.find((l) => l.kind === 'personal' && l.owner_id === me)
  const shared = lists.filter((l) => l.kind === 'shared')
  const membersQ = useQuery({
    queryKey: ['list-members', shared.map((l) => l.id).join()],
    enabled: shared.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('list_members')
        .select('list_id, user_id, profiles!list_members_user_id_fkey(nickname)')
        .in('list_id', shared.map((l) => l.id))
      if (error) throw error
      return data
    },
  })
  const membersOf = (id) => (membersQ.data ?? []).filter((m) => m.list_id === id)
  const refresh = () => qc.invalidateQueries({ queryKey: ['lists'] })
  const report = (error, okText) => setMsg(error ? { ok: false, text: error.message } : { ok: true, text: okText })

  async function toggle(e) {
    const { error } = await supabase.from('lists').update({ visible_to_partners: e.target.checked }).eq('id', personal.id)
    report(error, 'Preferência salva.')
    refresh()
  }
  async function create(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n || n.length > 60) return report({ message: 'O nome deve ter de 1 a 60 caracteres.' })
    const { data, error } = await supabase.from('lists').insert({ name: n, kind: 'shared' }).select('id').single()
    report(error, 'Lista criada. Gere um convite para chamar seu par.')
    if (!error) { setName(''); await refresh(); choose(data.id) }
  }
  async function join(e) {
    e.preventDefault()
    const { data, error } = await supabase.rpc('join_list', { code: code.trim() })
    report(error, 'Você entrou na lista!')
    if (!error) { setCode(''); await refresh(); choose(data) }
  }
  async function removeMember(listId, userId, self) {
    if (!window.confirm(self ? 'Sair desta lista?' : 'Remover esta pessoa da lista?')) return
    const { error } = await supabase.from('list_members').delete().eq('list_id', listId).eq('user_id', userId)
    report(error, self ? 'Você saiu da lista.' : 'Pessoa removida.')
    qc.invalidateQueries({ queryKey: ['list-members'] })
    refresh()
  }
  async function deleteList(l) {
    if (!window.confirm(`Excluir a lista "${l.name}" e todos os títulos dela? Isso não pode ser desfeito.`)) return
    const { error } = await supabase.from('lists').delete().eq('id', l.id)
    report(error, 'Lista excluída.')
    refresh()
  }
  async function invite(id) {
    const { data, error } = await supabase.rpc('new_invite', { l: id })
    if (error) return report(error)
    setCodes((c) => ({ ...c, [id]: data }))
  }

  const input = 'flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500'
  const btn = 'rounded-md bg-indigo-600 px-4 text-sm font-medium hover:bg-indigo-500'
  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-3 font-semibold">Listas</h2>

      {personal && (
        <label className="mb-4 flex items-start gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={personal.visible_to_partners} onChange={toggle} className="mt-1" />
          Deixar minha lista pessoal visível (somente leitura) para quem divide uma lista comigo
        </label>
      )}

      <ul className="mb-4 space-y-2">
        {shared.map((l) => (
          <li key={l.id} className="rounded-lg bg-zinc-950 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{l.name}</span>
              <span className="flex gap-3 text-xs">
                {l.owner_id === me ? (
                  <>
                    <button onClick={() => invite(l.id)} className="text-indigo-400 hover:underline">Gerar convite</button>
                    <button onClick={() => deleteList(l)} className="text-red-400 hover:underline">Excluir</button>
                  </>
                ) : (
                  <button onClick={() => removeMember(l.id, me, true)} className="text-red-400 hover:underline">Sair</button>
                )}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {membersOf(l.id).map((m) => (
                <li key={m.user_id} className="flex items-center justify-between">
                  <span>{m.profiles?.nickname ?? 'Usuário'}{m.user_id === l.owner_id ? ' (dono)' : ''}</span>
                  {l.owner_id === me && m.user_id !== me && (
                    <button onClick={() => removeMember(l.id, m.user_id)} className="text-red-400 hover:underline">Remover</button>
                  )}
                </li>
              ))}
            </ul>
            {codes[l.id] && (
              <p className="mt-2 text-xs text-zinc-400">
                Código (uso único): <b className="select-all font-mono text-zinc-100">{codes[l.id]}</b>
              </p>
            )}
          </li>
        ))}
        {!shared.length && <li className="text-sm text-zinc-500">Você ainda não tem listas compartilhadas.</li>}
      </ul>

      <form onSubmit={create} className="mb-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nova lista compartilhada (ex.: Nós dois)" className={input} />
        <button className={btn}>Criar</button>
      </form>
      <form onSubmit={join} className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tenho um código de convite" className={input} />
        <button className={btn}>Entrar</button>
      </form>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
    </section>
  )
}
