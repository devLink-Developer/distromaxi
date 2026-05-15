import { Link } from 'react-router-dom'

export function LegalAcceptance() {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-700 leading-6 text-slate-700">
      <input
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        name="accept_terms"
        type="checkbox"
        required
      />
      <span>
        Acepto los{' '}
        <Link className="font-800 text-brand-700 underline-offset-2 hover:underline" to="/terminos" target="_blank">
          Terminos y Condiciones
        </Link>{' '}
        y las{' '}
        <Link className="font-800 text-brand-700 underline-offset-2 hover:underline" to="/politicas-de-uso" target="_blank">
          Politicas de Uso
        </Link>{' '}
        de DistroMaxi.
      </span>
    </label>
  )
}
