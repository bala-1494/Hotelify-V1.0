'use client'

import { useAuth } from './AuthProvider'
import { usePathname, useRouter } from 'next/navigation'
import { landingPath } from '@/lib/permissions'

export default function Navbar() {
  const { user, role, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Role-aware navigation (S2.6). Housekeeping only sees the room board.
  const links: { href: string; label: string; show: boolean }[] = [
    { href: '/dashboard', label: 'Dashboard', show: role === 'owner' || role === 'manager' },
    { href: '/bookings', label: 'Bookings', show: role === 'owner' || role === 'manager' || role === 'front_desk' },
    { href: '/rooms', label: 'Rooms', show: !!role },
    { href: '/team', label: 'Team', show: role === 'owner' || role === 'manager' },
  ]

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <button
              onClick={() => router.push(landingPath(role))}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">H</span>
              </div>
              <span className="text-gray-900 font-bold text-xl tracking-tight">hotelify</span>
            </button>

            {user && (
              <div className="hidden md:flex items-center gap-1">
                {links.filter(l => l.show).map(l => {
                  const active = pathname === l.href
                  return (
                    <button
                      key={l.href}
                      onClick={() => router.push(l.href)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        active ? 'bg-primary-pale text-primary' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-4">
              {role && (
                <span className="text-xs font-medium text-gray-400 hidden sm:block capitalize">
                  {role.replace('_', '-')}
                </span>
              )}
              <span className="text-sm text-gray-400 hidden lg:block">{user.email}</span>
              <button
                onClick={() => { signOut(); router.push('/login') }}
                className="text-sm text-gray-500 hover:text-primary transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
