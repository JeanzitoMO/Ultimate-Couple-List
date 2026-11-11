// Sempre 32x32, conforme o requisito do projeto.
export default function Avatar({ url, name }) {
  if (url) return <img src={url} alt={name ?? 'Avatar'} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
      {(name ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}
