import { useEffect, useMemo, useState } from 'react'

import { usePwaInstallStore } from '../stores/pwaInstallStore'
import { Icon } from './Icon'

const DISMISS_KEY = 'distromax_pwa_install_dismissed'

export function PwaInstallPrompt() {
  const canInstall = usePwaInstallStore((state) => state.canInstall)
  const installed = usePwaInstallStore((state) => state.installed)
  const promptInstall = usePwaInstallStore((state) => state.promptInstall)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1')
  const [isIos, setIsIos] = useState(false)
  const [installing, setInstalling] = useState(false)
  const showIosInstructions = useMemo(() => isIos && !canInstall, [canInstall, isIos])

  useEffect(() => {
    const platform = navigator.userAgent || ''
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
    const iosDevice = /iPad|iPhone|iPod/.test(platform) || (platform.includes('Macintosh') && navigator.maxTouchPoints > 1)
    setIsIos(iosDevice && navigatorWithStandalone.standalone !== true)
  }, [])

  if (installed || dismissed || (!canInstall && !showIosInstructions)) return null

  async function handleInstall() {
    setInstalling(true)
    const result = await promptInstall()
    setInstalling(false)
    if (result !== 'unavailable') dismiss()
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <section
      className="fixed inset-x-4 bottom-20 z-[1200] rounded-lg border border-slate-200 bg-white p-3 shadow-2xl sm:bottom-4 sm:left-auto sm:w-[24rem]"
      aria-label="Instalar DistroMaxi"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-600 text-white">
          <Icon name="download" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-800 text-slate-950">Instalar DistroMaxi</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {showIosInstructions ? 'En iPhone o iPad, usa Compartir y luego Agregar a pantalla de inicio.' : 'Accede desde el escritorio o la pantalla de inicio con experiencia de app.'}
          </p>
        </div>
        <button className="min-h-11 min-w-11 rounded-md text-slate-500 hover:bg-slate-100" type="button" aria-label="Cerrar instalacion" onClick={dismiss}>
          <Icon name="close" className="mx-auto h-5 w-5" />
        </button>
      </div>
      {canInstall ? (
        <button
          className="mt-3 min-h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-800 text-white disabled:opacity-60"
          type="button"
          disabled={installing}
          onClick={() => void handleInstall()}
        >
          {installing ? 'Abriendo instalacion...' : 'Instalar app'}
        </button>
      ) : null}
    </section>
  )
}
