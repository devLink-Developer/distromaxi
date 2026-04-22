import { Link } from 'react-router-dom'

const BRAND_LOGO_SRC = '/logo.png?v=20260422-1028'

type BrandLogoSize = 'compact' | 'nav' | 'sidebar'

type BrandLogoProps = {
  to?: string
  compact?: boolean
  dark?: boolean
  size?: BrandLogoSize
  className?: string
}

export function BrandLogo({ to, compact = false, dark = false, size, className = '' }: BrandLogoProps) {
  const resolvedSize = size ?? (compact ? 'compact' : 'nav')
  const image = (
    <>
      <img
        src={BRAND_LOGO_SRC}
        alt="DistroMaxi"
        className={`${logoSizeClass(resolvedSize)} object-contain ${dark ? 'drop-shadow-[0_10px_24px_rgba(15,23,42,0.34)]' : ''}`}
      />
      <span className="sr-only">DistroMaxi</span>
    </>
  )

  if (to) {
    return (
      <Link aria-label="DistroMaxi" className={`inline-flex shrink-0 items-center ${logoFrameClass(resolvedSize)} ${className}`.trim()} to={to}>
        {image}
      </Link>
    )
  }

  return <div className={`inline-flex shrink-0 items-center ${logoFrameClass(resolvedSize)} ${className}`.trim()}>{image}</div>
}

function logoSizeClass(size: BrandLogoSize) {
  if (size === 'sidebar') return 'h-[30px] w-auto'
  if (size === 'compact') return 'h-[30px] w-auto'
  return 'h-[30px] w-auto'
}

function logoFrameClass(size: BrandLogoSize) {
  if (size === 'sidebar') return 'min-h-[30px]'
  if (size === 'compact') return 'min-h-[30px]'
  return 'min-h-[30px]'
}
