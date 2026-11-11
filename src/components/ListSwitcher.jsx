import { useLists } from '../context/ListContext'

export default function ListSwitcher() {
  const { lists, active, choose, label } = useLists()
  if (!lists.length) return null
  return (
    <select value={active?.id ?? ''} onChange={(e) => choose(e.target.value)} aria-label="Lista ativa"
      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500">
      {lists.map((l) => <option key={l.id} value={l.id}>{label(l)}</option>)}
    </select>
  )
}
