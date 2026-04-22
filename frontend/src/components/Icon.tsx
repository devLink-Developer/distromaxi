type IconName =
  | 'home'
  | 'box'
  | 'cart'
  | 'close'
  | 'menu'
  | 'orders'
  | 'truck'
  | 'users'
  | 'bell'
  | 'route'
  | 'wallet'
  | 'upload'
  | 'search'
  | 'pin'
  | 'logout'

const paths: Record<IconName, string> = {
  home: 'M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z',
  box: 'M21 8.5 12 3 3 8.5l9 5.5 9-5.5ZM3 10.5V18l9 5.5V16L3 10.5Zm18 0L12 16v7.5l9-5.5v-7.5Z',
  cart: 'M5 6h16l-2 8H8L6 3H3m6 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  orders: 'M7 3h10v4H7V3Zm-2 7h14v11H5V10Zm4 4h6m-6 4h4',
  truck: 'M3 7h11v9H3V7Zm11 3h4l3 4v2h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  users: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm-12 9c1.5-3 4.2-5 8-5s6.5 2 8 5M19 8a3 3 0 0 1 0 6m-14 0a3 3 0 0 1 0-6',
  bell: 'M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Zm-8 4h4',
  route: 'M5 5h4v4H5V5Zm10 10h4v4h-4v-4ZM7 9c0 6 10-1 10 6',
  wallet: 'M4 6h15a1 1 0 0 1 1 1v3h-5a3 3 0 0 0 0 6h5v3a1 1 0 0 1-1 1H4V6Zm11 6h6v2h-6a1 1 0 0 1 0-2Z',
  upload: 'M12 16V4m0 0 4 4m-4-4-4 4M4 16v4h16v-4',
  search: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8 7.5 7.5 0 0 1-5.3 12.8Zm5.5-2 5 5',
  pin: 'M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  logout: 'M14 8V5a1 1 0 0 0-1-1H5v16h8a1 1 0 0 0 1-1v-3m-2-4h9m0 0-3-3m3 3-3 3',
}

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[name]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
