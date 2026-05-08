import { useEffect, useRef, useState } from 'react'

const TRUST_LOGO_IMAGE = 'https://micuenta.donweb.com/img/sectigo_positive_lg.png'
const TRUST_LOGO_LINK = 'https://donweb.com/es-ar/certificados-ssl'
const TRUST_LOGO_CODE = 'CL1'
const TRUST_LOGO_POSITION = 'none'

declare global {
  interface Window {
    TrustLogo?: (logoUrl: string, trustCode: string, position: string) => void
  }
}

type CertificateTrustLogoProps = {
  className?: string
}

export function CertificateTrustLogo({ className = '' }: CertificateTrustLogoProps) {
  const sealRef = useRef<HTMLDivElement>(null)
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    const seal = sealRef.current
    if (!seal) return

    seal.innerHTML = ''

    if (typeof window.TrustLogo !== 'function') {
      setShowFallback(true)
      return
    }

    const originalWrite = document.write
    const originalWriteln = document.writeln

    const writeIntoSeal = (...parts: string[]) => {
      const markup = parts.join('')
      if (markup) seal.insertAdjacentHTML('beforeend', markup)
    }

    document.write = writeIntoSeal
    document.writeln = (...parts: string[]) => writeIntoSeal(...parts, '\n')

    try {
      window.TrustLogo(TRUST_LOGO_IMAGE, TRUST_LOGO_CODE, TRUST_LOGO_POSITION)
      seal.querySelector('img')?.setAttribute('alt', 'Sello Sectigo PositiveSSL')
      seal.querySelector('a')?.setAttribute('aria-label', 'Verificar certificado SSL Sectigo')
      setShowFallback(false)
    } catch {
      seal.innerHTML = ''
      setShowFallback(true)
    } finally {
      document.write = originalWrite
      document.writeln = originalWriteln
    }

    return () => {
      seal.innerHTML = ''
    }
  }, [])

  return (
    <div
      className={`inline-flex flex-col items-start gap-1 ${className}`.trim()}
      role="group"
      aria-label="Certificado SSL Sectigo"
    >
      <div ref={sealRef} className={showFallback ? 'hidden' : 'min-h-[54px] min-w-[222px]'} />

      {showFallback ? (
        <a
          href={TRUST_LOGO_LINK}
          target="_blank"
          rel="noreferrer"
          aria-label="Ver certificados SSL Argentina"
        >
          <img
            src={TRUST_LOGO_IMAGE}
            width="222"
            height="54"
            alt="Sello Sectigo PositiveSSL"
            className="h-[54px] w-[222px] object-contain"
          />
        </a>
      ) : null}

      <a
        href={TRUST_LOGO_LINK}
        id="comodoTL"
        title="Certificados SSL Argentina"
        target="_blank"
        rel="noreferrer"
        className="text-[8px] leading-none text-white/80 underline-offset-2 hover:text-white hover:underline"
      >
        Certificados SSL Argentina
      </a>
    </div>
  )
}
