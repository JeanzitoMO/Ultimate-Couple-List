import { createContext, useContext, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ListContext = createContext(null)

export function ListProvider({ children }) {
  const { session } = useAuth()
  const me = session?.user.id
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem('activeList') } catch { return null }
  })

  const query = useQuery({
    queryKey: ['lists', me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, kind, owner_id, visible_to_partners, created_at, owner:profiles!lists_owner_id_fkey(nickname)')
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const lists = query.data ?? []
  const active = lists.find((l) => l.id === activeId) ?? lists.find((l) => l.kind === 'shared') ?? lists[0] ?? null
  const canEdit = !!active && (active.kind === 'shared' || active.owner_id === me)

  const choose = (id) => {
    setActiveId(id)
    try { localStorage.setItem('activeList', id) } catch { /* ignora */ }
  }
  const label = (l) =>
    l.kind === 'shared' ? `${l.name} (compartilhada)`
    : l.owner_id === me ? 'Minha lista'
    : `Lista de ${l.owner?.nickname ?? 'parceiro(a)'} (somente leitura)`

  return (
    <ListContext.Provider value={{ lists, active, canEdit, choose, label, loading: query.isLoading, error: query.error }}>
      {children}
    </ListContext.Provider>
  )
}

export const useLists = () => useContext(ListContext)
