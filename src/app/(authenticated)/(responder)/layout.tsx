'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/ui/TopBar'
import ResponderSidebar from '@/components/responder/ResponderSidebar'
import { getWalletBalance } from '@/services/survey.service'
import { supabase } from '@/lib/supabase'

export default function ResponderLayout({ children }: { children: React.ReactNode }) {
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  const fetchWallet = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const wallet = await getWalletBalance()
      setWalletBalance(wallet.balance)
    } catch {
      setWalletBalance(null)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchWallet()

    // Listen for a custom event dispatched by the survey submission page.
    // This is simpler and more reliable than a Supabase realtime subscription
    // because it doesn't depend on REPLICA IDENTITY or any DB-level config.
    const handleWalletUpdated = () => fetchWallet()
    window.addEventListener('wallet-updated', handleWalletUpdated)

    return () => {
      window.removeEventListener('wallet-updated', handleWalletUpdated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar walletBalance={walletBalance} />
      <div className="md:flex">
        <ResponderSidebar />
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
