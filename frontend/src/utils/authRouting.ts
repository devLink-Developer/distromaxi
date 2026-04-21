import type { User } from '../types/domain'

export function defaultRouteForUser(user: User) {
  if (user.role === 'ADMIN') return '/admin/distributors'
  if (user.role === 'DRIVER') return '/driver/deliveries'
  if (user.role === 'DISTRIBUTOR') return user.distributor_access.state === 'ACTIVE' ? '/dashboard' : '/distributor/onboarding'
  return '/home'
}

export function distributorNeedsOnboarding(user: User | null | undefined) {
  return user?.role === 'DISTRIBUTOR' && user.distributor_access.state !== 'ACTIVE'
}
