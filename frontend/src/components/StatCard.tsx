export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint: string
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <strong className="mt-2 block text-2xl font-800 text-slate-950">{value}</strong>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </article>
  )
}
