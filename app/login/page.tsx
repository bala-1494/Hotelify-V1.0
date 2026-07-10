'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const { user, signIn, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Let the root router decide onboarding vs dashboard based on membership.
    if (!loading && user) router.push('/')
  }, [user, loading, router])

  const handleSignIn = () => {
    signIn()
    router.push('/')
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-primary font-bold text-xl">H</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">hotelify</span>
        </div>

        <div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Manage your hotel<br />with intelligence.
          </h1>
          <p className="text-red-200 text-lg leading-relaxed">
            Import any hotel from Google Maps. Get photos, reviews, location, and a complete marketing page — in seconds.
          </p>
        </div>

        <p className="text-red-300 text-sm">© 2025 Hotelify. All rights reserved.</p>
      </div>

      {/* Right — login panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-12 lg:hidden">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">H</span>
            </div>
            <span className="text-primary font-bold text-2xl tracking-tight">hotelify</span>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-400 mb-10">Sign in to your hotel management dashboard</p>

          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 rounded-xl py-4 px-6 hover:border-gray-300 hover:bg-gray-50 transition-all group"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-gray-700 font-medium group-hover:text-gray-900">Sign in with Google</span>
          </button>

          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 text-center">
              <span className="font-medium text-gray-600">Demo account:</span>{' '}
              admin@hotelify.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
