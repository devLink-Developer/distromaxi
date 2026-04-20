const labels: Record<string, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptado',
  PREPARING: 'Preparando',
  ON_THE_WAY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  ACTIVE: 'Activa',
  TRIAL: 'Prueba',
  PAST_DUE: 'Vencida',
  SUSPENDED: 'Suspendida',
  ASSIGNED: 'Asignada',
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'DELIVERED' || status === 'ACTIVE'
      ? 'bg-mint-50 text-mint-700 ring-mint-500/20'
      : status === 'CANCELLED' || status === 'PAST_DUE' || status === 'SUSPENDED'
        ? 'bg-red-50 text-red-700 ring-red-500/20'
        : 'bg-brand-50 text-brand-700 ring-brand-500/20'
  return (
    <span className={`inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-semibold ring-1 ${tone}`}>
      {labels[status] ?? status}
    </span>
  )
}
