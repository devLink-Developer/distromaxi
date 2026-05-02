import { create } from 'zustand'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallResult = 'accepted' | 'dismissed' | 'unavailable'

type PwaInstallState = {
  canInstall: boolean
  installed: boolean
  promptInstall: () => Promise<InstallResult>
  clearInstallPrompt: () => void
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

export const usePwaInstallStore = create<PwaInstallState>((set) => ({
  canInstall: false,
  installed: isStandaloneDisplay(),
  async promptInstall() {
    if (!deferredPrompt) return 'unavailable'
    const promptEvent = deferredPrompt
    deferredPrompt = null
    set({ canInstall: false })
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    return choice.outcome
  },
  clearInstallPrompt() {
    deferredPrompt = null
    set({ canInstall: false })
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    usePwaInstallStore.setState({ canInstall: true, installed: false })
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    usePwaInstallStore.setState({ canInstall: false, installed: true })
  })
}
