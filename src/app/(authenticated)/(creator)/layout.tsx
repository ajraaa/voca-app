'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/ui/TopBar'
import CreatorSidebar from '@/components/creator/CreatorSidebar'
import { getWalletBalance } from '@/services/survey.service'
import { supabase } from '@/lib/supabase'

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchWallet = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const wallet = await getWalletBalance()
        if (!cancelled) setWalletBalance(wallet.balance)
      } catch {
        if (!cancelled) setWalletBalance(null)
      }
    }

    fetchWallet()

    const handleWalletUpdated = () => fetchWallet()
    window.addEventListener('wallet-updated', handleWalletUpdated)

    return () => {
      cancelled = true
      window.removeEventListener('wallet-updated', handleWalletUpdated)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar walletBalance={walletBalance} />
      <div className="md:flex">
        <CreatorSidebar />
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
