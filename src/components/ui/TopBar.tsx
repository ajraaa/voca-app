'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function TopBar({ walletBalance }: { walletBalance: number | null }) {
  const pathname = usePathname()
  const router = useRouter()

  const isCreatorRoute = pathname?.startsWith('/creator') || pathname?.startsWith('/my-surveys')
  const isResponderRoute = pathname?.startsWith('/responder') || pathname?.startsWith('/surveys') || pathname?.startsWith('/my-responses')

  const [user, setUser] = useState<User | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Local state for instant visual feedback of the slide animation
  const [activeMode, setActiveMode] = useState<'creator' | 'responder'>(
    isCreatorRoute ? 'creator' : 'responder'
  )

  // Fetch Supabase user session data on mount and listen to changes
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Synchronize state with route changes (e.g., initial load or backward/forward navigation)
  useEffect(() => {
    if (isCreatorRoute) {
      setActiveMode('creator')
    } else if (isResponderRoute) {
      setActiveMode('responder')
    }
  }, [isCreatorRoute, isResponderRoute])

  // Cache user's active workspace preference in localStorage
  useEffect(() => {
    if (isCreatorRoute) {
      localStorage.setItem('lastWorkspace', 'creator')
    } else if (isResponderRoute) {
      localStorage.setItem('lastWorkspace', 'responder')
    }
  }, [isCreatorRoute, isResponderRoute])

  const handleSwitchMode = (target: 'creator' | 'responder') => {
    if (target === activeMode) return
    
    // Instantly trigger local slide animation and text color transition!
    setActiveMode(target)

    // Defer the Next.js routing by 500ms to allow the wobbly animation to be seen in full
    setTimeout(() => {
      router.push(target === 'creator' ? '/creator' : '/responder')
    }, 500)
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-4 md:px-6">
      <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
        <div className="h-9 w-9 shrink-0 rounded border border-gray-300 bg-blue-600 sm:h-10 sm:w-10 flex items-center justify-center text-white font-black" aria-label="Logo">
          V
        </div>
        <span className="min-w-0 text-lg font-bold text-gray-900 sm:text-xl hidden xs:inline">Voca</span>
      </Link>

      {/* Segmented Workspace Switcher (Icon-based) */}
      <div className="relative flex items-center rounded-full bg-gray-100 p-0.5 border border-gray-200/80 ml-2 sm:ml-4">
        {/* Active capsule slider with a custom spring-wobble bezier curve */}
        <div
          className={`absolute top-0.5 bottom-0.5 rounded-full transition-all duration-[450ms] shadow-sm ${
            activeMode === 'creator'
              ? 'left-0.5 w-[calc(50%-1px)] bg-blue-600 shadow-blue-500/10'
              : 'left-[calc(50%-0.5px)] w-[calc(50%-1px)] bg-emerald-600 shadow-emerald-500/10'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.34, 1.85, 0.64, 1)',
          }}
        />

        <button
          onClick={() => handleSwitchMode('creator')}
          title="Creator Workspace"
          aria-label="Switch to Creator Mode"
          className={`relative z-10 w-10 sm:w-11 h-8 flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer select-none active:scale-90 ${
            activeMode === 'creator' ? 'text-white' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {/* Pen / Creation Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={() => handleSwitchMode('responder')}
          title="Respondent Workspace"
          aria-label="Switch to Respondent Mode"
          className={`relative z-10 w-10 sm:w-11 h-8 flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer select-none active:scale-90 ${
            activeMode === 'responder' ? 'text-white' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {/* Checklist / Survey Answer Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="max-w-[35vw] truncate whitespace-nowrap rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 sm:max-w-none sm:px-4 sm:text-sm">
          Balance: {walletBalance === null ? '-' : formatCurrency(walletBalance)}
        </div>

        {/* Dynamic Profile Dropdown Wrapper */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            title="User Profile & Settings"
            className="h-9 w-9 shrink-0 rounded-full border border-gray-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:ring-2 hover:ring-blue-100/50 sm:h-10 sm:w-10 flex items-center justify-center text-xs sm:text-sm font-extrabold cursor-pointer select-none transition-all duration-200"
          >
            {user?.email?.[0].toUpperCase() ?? 'U'}
          </button>

          {isDropdownOpen && (
            <>
              {/* Invisible overlay backing to close dropdown on outside clicks */}
              <div 
                className="fixed inset-0 z-20 cursor-default" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              
              {/* Dropdown Menu Card */}
              <div className="absolute right-0 mt-2.5 w-60 rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-lg z-30 transform origin-top-right transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                
                {/* User email context header */}
                <div className="px-3.5 py-3 border-b border-gray-100 flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Signed in as</span>
                  <span className="text-sm font-semibold text-gray-800 truncate" title={user?.email ?? ''}>
                    {user?.email ?? 'Loading active session...'}
                  </span>
                </div>

                {/* Contextual Navigation Links */}
                <div className="py-1">
                  <Link
                    href={isCreatorRoute ? '/creator/profile' : '/responder/profile'}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Profile
                  </Link>

                  <Link
                    href={isCreatorRoute ? '/creator/wallet' : '/responder/wallet'}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    My Wallet
                  </Link>

                  {isAdmin(user?.email) && (
                    <Link
                      href="/admin/withdrawals"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Admin Dashboard
                    </Link>
                  )}
                </div>

                {/* Sign Out Action */}
                <div className="border-t border-gray-100 pt-1.5 pb-0.5">
                  <button
                    onClick={async () => {
                      setIsDropdownOpen(false)
                      const { error } = await supabase.auth.signOut()
                      if (!error) {
                        router.push('/')
                        router.refresh()
                      } else {
                        console.error('Sign-out error:', error.message)
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

