'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      console.error('Sign-out error:', error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sleek Minimal Admin Header */}
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/admin/withdrawals" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
            <div className="h-9 w-9 shrink-0 rounded border border-gray-300 bg-blue-600 flex items-center justify-center text-white font-black" aria-label="Logo">
              V
            </div>
            <span className="text-lg font-bold text-gray-900">Voca Admin</span>
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-xl border border-red-250 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 shadow-sm transition-all hover:bg-red-100/80 active:scale-95 cursor-pointer"
        >
          Logout
        </button>
      </header>

      <main className="p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
