import { Link } from 'react-router-dom'

const BRAND_LOGO_SRC = '/logo.png?v=20260422-1028'

type BrandLogoProps = {
  to?: string
  compact?: boolean
  dark?: boolean
  className?: string
}

export function BrandLogo({ to, compact = false, dark = false, className = '' }: BrandLogoProps) {
  const image = (
    <>
      <img
        src={BRAND_LOGO_SRC}
        alt="DistroMaxi"
        className={`${compact ? 'h-11 w-11' : 'h-12 w-12 sm:h-14 sm:w-14'} object-contain ${dark ? 'drop-shadow-[0_10px_24px_rgba(15,23,42,0.34)]' : ''}`}
      />
      <span className="sr-only">DistroMaxi</span>
    </>
  )

  if (to) {
    return (
      <Link aria-label="DistroMaxi" className={`inline-flex items-center ${className}`.trim()} to={to}>
        {image}
      </Link>
    )
  }

  return <div className={`inline-flex items-center ${className}`.trim()}>{image}</div>
}
