'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletStats {
  total_earned: number
  total_withdrawn: number
  pending: number
}

interface Transaction {
  id: string
  type: 'reward' | 'fee' | 'refund' | 'withdraw' | 'spend' | 'topup' | 'withdraw_request' | 'withdraw_success' | 'withdraw_failed_refund'
  amount: number
  status: 'pending' | 'success' | 'failed'
  reference_id: string | null
  reference_type: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface WalletData {
  balance: number
  locked_balance: number
  email: string
  reputation_score: number
  stats: WalletStats
  transactions: Transaction[]
}

type WithdrawStep = 'idle' | 'amount' | 'details' | 'confirm' | 'loading' | 'success' | 'error'

interface BankChannel {
  code: string
  label: string
  type: 'bank' | 'ewallet'
  color: string
}

// ─── Bank Channel Definitions ─────────────────────────────────────────────────

const BANK_CHANNELS: BankChannel[] = [
  { code: 'ID_BCA',     label: 'BCA',     type: 'bank',    color: 'bg-blue-600'   },
  { code: 'ID_BNI',     label: 'BNI',     type: 'bank',    color: 'bg-orange-500' },
  { code: 'ID_BRI',     label: 'BRI',     type: 'bank',    color: 'bg-sky-500'    },
  { code: 'ID_MANDIRI', label: 'Mandiri', type: 'bank',    color: 'bg-yellow-500' },
  { code: 'ID_BSI',     label: 'BSI',     type: 'bank',    color: 'bg-green-600'  },
  { code: 'ID_CIMB',   label: 'CIMB',   type: 'bank',    color: 'bg-red-600'    },
  { code: 'ID_OVO',    label: 'OVO',    type: 'ewallet', color: 'bg-purple-600' },
  { code: 'ID_DANA',   label: 'DANA',   type: 'ewallet', color: 'bg-sky-400'    },
  { code: 'ID_SHOPEEPAY', label: 'ShopeePay', type: 'ewallet', color: 'bg-orange-600' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)

const formatThousand = (val: string) => {
  const clean = val.replace(/\D/g, '')
  if (!clean) return ''
  return new Intl.NumberFormat('id-ID').format(parseInt(clean, 10))
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

// Label & style for transaction type
function txTypeLabel(type: Transaction['type']): { label: string; pill: string } {
  switch (type) {
    case 'topup':    return { label: 'Top Up',   pill: 'bg-indigo-100 text-indigo-700' }
    case 'reward':   return { label: 'Reward',   pill: 'bg-emerald-100 text-emerald-700' }
    case 'refund':   return { label: 'Refund',   pill: 'bg-blue-100 text-blue-700' }
    case 'withdraw':
    case 'withdraw_request':
    case 'withdraw_success':
                     return { label: 'Withdraw', pill: 'bg-rose-100 text-rose-700' }
    case 'withdraw_failed_refund':
                     return { label: 'Refund',   pill: 'bg-blue-100 text-blue-700' }
    case 'spend':    return { label: 'Spend',    pill: 'bg-orange-100 text-orange-700' }
    case 'fee':      return { label: 'Fee',      pill: 'bg-gray-100 text-gray-600' }
    default:         return { label: type,       pill: 'bg-gray-100 text-gray-600' }
  }
}

// Human-readable description from transaction type + metadata
function txDescription(tx: Transaction): string {
  const meta = tx.metadata as Record<string, string> | null
  const type = meta?.ledger_type || tx.type
  switch (type) {
    case 'topup':
      return 'Top up saldo via Pakasir'
    case 'reward':
      return `Reward survey — ${tx.reference_type ?? 'response'}`
    case 'refund':
      return meta?.reason === 'remaining_budget'
        ? 'Refund sisa budget survey'
        : 'Refund'
    case 'withdraw':
    case 'withdraw_request':
      return 'Permintaan penarikan saldo'
    case 'withdraw_success':
      return 'Penarikan saldo berhasil dicairkan'
    case 'withdraw_failed_refund':
      return 'Pengembalian saldo penarikan gagal'
    case 'spend':
      return 'Pembayaran reward responden'
    case 'fee':
      return 'Biaya platform (5%)'
    default:
      return 'Transaksi'
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-extrabold leading-tight">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WalletPageContent() {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topupAmount, setTopupAmount] = useState<string>('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null)

  // ── Withdraw state ──────────────────────────────────────────────────────────
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('idle')
  const [withdrawAmount, setWithdrawAmount] = useState<string>('')
  const [withdrawChannel, setWithdrawChannel] = useState<string>('')
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState<string>('')
  const [withdrawAccountName, setWithdrawAccountName] = useState<string>('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawResult, setWithdrawResult] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  const loadWallet = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetchWithAuth('/api/wallet')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal memuat data wallet')
      }
      const json = await res.json()
      setData(json.data)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    loadWallet(true)

    // Scan for redirect parameters from Pakasir payment gateway
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (status === 'success') {
      setPaymentSuccess('Top up saldo berhasil diproses! Saldo akan segera masuk ke akunmu.')
      router.replace(window.location.pathname)
    } else if (status === 'failed') {
      setTopupError('Pembayaran top up gagal atau dibatalkan. Silakan coba lagi.')
      router.replace(window.location.pathname)
    }
  }, [])

  // ── Withdraw handlers ─────────────────────────────────────────────────────

  const openWithdrawModal = () => {
    setWithdrawStep('amount')
    setWithdrawAmount('')
    setWithdrawChannel('')
    setWithdrawAccountNumber('')
    setWithdrawAccountName('')
    setWithdrawError(null)
    setWithdrawResult(null)
  }

  const closeWithdrawModal = () => setWithdrawStep('idle')

  const handleWithdrawAmountNext = () => {
    const amt = parseInt(withdrawAmount.replace(/\./g, ''), 10)
    if (isNaN(amt) || amt < 10000) {
      setWithdrawError('Nominal penarikan harus minimal Rp 10.000')
      return
    }
    if (data && amt > data.balance) {
      setWithdrawError('Nominal melebihi saldo aktif kamu')
      return
    }
    setWithdrawError(null)
    setWithdrawStep('details')
  }

  const handleWithdrawDetailsNext = () => {
    if (!withdrawChannel) {
      setWithdrawError('Pilih bank atau e-wallet tujuan')
      return
    }
    if (!withdrawAccountNumber.trim()) {
      setWithdrawError('Nomor rekening/akun harus diisi')
      return
    }
    if (!withdrawAccountName.trim()) {
      setWithdrawError('Nama pemilik rekening/akun harus diisi')
      return
    }
    setWithdrawError(null)
    setWithdrawStep('confirm')
  }

  const handleWithdrawSubmit = async () => {
    setWithdrawStep('loading')
    setWithdrawError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const amount = parseInt(withdrawAmount.replace(/\./g, ''), 10)

      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount,
          channel_code: withdrawChannel,
          account_number: withdrawAccountNumber.trim(),
          account_holder_name: withdrawAccountName.trim() || undefined,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal memproses penarikan')

      setWithdrawResult('Permintaan penarikan saldo berhasil diajukan. Dana akan masuk ke rekening kamu dalam 1-2 hari kerja.')
      setWithdrawStep('success')
      // Refresh wallet data in background
      loadWallet(false)
      window.dispatchEvent(new Event('wallet-updated'))
    } catch (err: any) {
      setWithdrawError(err.message || 'Terjadi kesalahan')
      setWithdrawStep('error')
    }
  }

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    setTopupError(null)
    const amount = parseInt(topupAmount.replace(/\./g, ''), 10)
    if (isNaN(amount) || amount < 10000) {
      setTopupError('Nominal top up harus berupa angka bulat minimal Rp 10.000')
      return
    }

    setTopupLoading(true)
    try {
      const response = await fetchWithAuth('/api/payments/topup', {
        method: 'POST',
        body: JSON.stringify({ amount })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Gagal membuat transaksi top up')
      }

      const redirectUrl = result.redirect_url
      if (!redirectUrl) {
        throw new Error('URL pembayaran tidak valid dari payment gateway')
      }

      // Redirect user to the Pakasir payment page
      window.location.href = redirectUrl
    } catch (err: any) {
      setTopupError(err.message || 'Terjadi kesalahan saat memproses pembayaran')
    } finally {
      setTopupLoading(false)
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl animate-pulse">
        {/* Header */}
        <div className="mb-6 space-y-2">
          <div className="h-7 w-24 rounded-lg bg-gray-200" />
          <div className="h-4 w-56 rounded bg-gray-100" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                'border-blue-100 bg-blue-50',
                'border-emerald-100 bg-emerald-50',
                'border-rose-100 bg-rose-50',
                'border-amber-100 bg-amber-50',
              ].map((accent, i) => (
                <div key={i} className={`rounded-xl border p-5 flex flex-col gap-2 ${accent}`}>
                  <div className="h-3 w-20 rounded bg-current opacity-20" />
                  <div className="h-7 w-32 rounded-md bg-current opacity-25" />
                  <div className="h-3 w-24 rounded bg-current opacity-15" />
                </div>
              ))}
            </div>

            {/* Transaction table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="h-4 w-36 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>

              {/* Table rows */}
              <div className="divide-y divide-gray-50">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                    {/* Date */}
                    <div className="h-3 w-20 rounded bg-gray-100 shrink-0" />
                    {/* Description */}
                    <div className="h-3 flex-1 max-w-[180px] rounded bg-gray-100" />
                    {/* Type pill */}
                    <div className="h-5 w-14 rounded-full bg-gray-100 shrink-0" />
                    {/* Amount */}
                    <div className="h-4 w-24 rounded bg-gray-100 shrink-0 ml-auto" />
                    {/* Status */}
                    <div className="h-3 w-14 rounded bg-gray-100 shrink-0 hidden sm:block" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Virtual card skeleton */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-200 via-slate-100 to-stone-200 p-6 min-h-[180px] flex flex-col justify-between shadow-xl">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-slate-300/40 blur-2xl" />
              <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-slate-300/40 blur-2xl" />
              <div className="flex items-center justify-between">
                <div className="h-3 w-28 rounded bg-slate-300/60" />
                <div className="h-6 w-8 rounded bg-slate-300/50" />
              </div>
              <div className="my-5 space-y-2">
                <div className="h-3 w-20 rounded bg-slate-300/50" />
                <div className="h-8 w-40 rounded-md bg-slate-300/60" />
              </div>
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <div className="h-2.5 w-16 rounded bg-slate-300/40" />
                  <div className="h-3 w-32 rounded bg-slate-300/50" />
                </div>
                <div className="h-5 w-10 rounded bg-slate-300/40" />
              </div>
            </div>

            {/* Withdraw action box */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-4/5 rounded bg-gray-100" />
              </div>
              <div className="h-11 w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50" />
            </div>

            {/* Info card */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-blue-100" />
              <div className="space-y-2 pl-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-3 rounded bg-blue-100" style={{ width: `${85 - i * 10}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
          <p className="text-sm text-gray-500">Kelola saldo dan riwayat transaksimu.</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center shadow-sm">
          <p className="text-red-700 font-medium">{error || 'Data wallet tidak tersedia.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      </section>
    )
  }

  const { balance, locked_balance, email, reputation_score, stats, transactions } = data

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <section className="mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <p className="text-sm text-gray-500">Kelola saldo dan riwayat transaksimu.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Saldo Aktif"
              value={formatIDR(balance)}
              sub="Bisa ditarik"
              accent="border-blue-200 bg-blue-50 text-blue-900"
            />
            <StatCard
              label="Total Earned (Net)"
              value={formatIDR(stats.total_earned)}
              sub="Setelah biaya platform 5%"
              accent="border-emerald-200 bg-emerald-50 text-emerald-900"
            />
            <StatCard
              label="Total Withdrawn"
              value={formatIDR(stats.total_withdrawn)}
              sub="Berhasil dicairkan"
              accent="border-rose-200 bg-rose-50 text-rose-900"
            />
            <StatCard
              label="Terkunci"
              value={formatIDR(locked_balance)}
              sub="Budget survey aktif"
              accent="border-amber-200 bg-amber-50 text-amber-900"
            />
          </div>

          {/* Transaction History */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Card Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Riwayat Transaksi</h2>
              <span className="text-xs text-gray-400 font-medium">50 transaksi terakhir</span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-3">
                  📭
                </div>
                <p className="text-sm font-semibold text-gray-600">Belum ada transaksi</p>
                <p className="text-xs text-gray-400 mt-1">Riwayat transaksi akan muncul di sini setelah kamu mengisi survey atau menarik saldo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tipe</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Jumlah</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap hidden sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => {
                      const ledgerType = (tx.metadata as any)?.ledger_type || tx.type
                      const { label, pill } = txTypeLabel(ledgerType)
                      const isCredit = ledgerType === 'topup' || ledgerType === 'reward' || ledgerType === 'refund' || ledgerType === 'withdraw_failed_refund'
                      const isDebit = ledgerType === 'withdraw' || ledgerType === 'withdraw_request' || ledgerType === 'withdraw_success' || ledgerType === 'spend' || ledgerType === 'fee'

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-gray-50/70 transition-colors"
                        >
                          {/* Date */}
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                            {formatDate(tx.created_at)}
                          </td>

                          {/* Description */}
                          <td className="px-5 py-3.5 text-gray-700 max-w-[220px]">
                            <div className="flex flex-col">
                              <span className="line-clamp-1 text-gray-800 font-medium">{txDescription(tx)}</span>
                              {tx.type === 'withdraw' && (tx.metadata as any)?.failure_reason && (
                                <span className="text-[11px] font-semibold text-red-500 mt-0.5">
                                  Alasan: {(tx.metadata as any).failure_reason}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Type pill */}
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill}`}>
                              {label}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className={`px-5 py-3.5 text-right font-semibold whitespace-nowrap ${
                            isCredit ? 'text-emerald-600' : isDebit ? 'text-rose-600' : 'text-gray-700'
                          }`}>
                            {isCredit ? '+' : isDebit ? '−' : ''}{formatIDR(tx.amount)}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                            {tx.status === 'success' && (
                              <span className="text-xs font-medium text-emerald-600">✓ Sukses</span>
                            )}
                            {tx.status === 'pending' && (
                              <span className="text-xs font-medium text-amber-600">⏳ Pending</span>
                            )}
                            {tx.status === 'failed' && (
                              <span className="text-xs font-medium text-red-500">✕ Gagal</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Virtual Card & Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* Glowing Dynamic Virtual Voca Card */}
          {(() => {
            const score = reputation_score ?? 100
            let tierName = 'VOCA PLATINUM'
            let bgClass = 'from-slate-900 via-slate-800 to-indigo-950'
            let textClass = 'text-white'
            let labelClass = 'text-indigo-200/60'
            let subLabelClass = 'text-indigo-200/50'
            let glowClass = 'bg-blue-500/10'

            if (score < 50) {
              tierName = 'VOCA SILVER'
              bgClass = 'from-slate-200 via-slate-100 to-stone-300 border border-slate-300'
              textClass = 'text-slate-800'
              labelClass = 'text-slate-500'
              subLabelClass = 'text-slate-400'
              glowClass = 'bg-slate-400/20'
            } else if (score < 80) {
              tierName = 'VOCA GOLD'
              bgClass = 'from-amber-400 via-yellow-400 to-amber-500 border border-amber-300'
              textClass = 'text-stone-900'
              labelClass = 'text-amber-900/70'
              subLabelClass = 'text-amber-900/60'
              glowClass = 'bg-yellow-400/30'
            } else if (score >= 100) {
              tierName = 'VOCA OBSIDIAN'
              bgClass = 'from-neutral-950 via-stone-900 to-emerald-950 border border-emerald-900/40'
              textClass = 'text-white'
              labelClass = 'text-emerald-300/60'
              subLabelClass = 'text-emerald-300/40'
              glowClass = 'bg-emerald-500/20'
            }

            return (
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bgClass} p-6 ${textClass} shadow-xl min-h-[180px] flex flex-col justify-between select-none transition-all duration-300`}>
                {/* Glossy overlay effect */}
                <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${glowClass} blur-2xl`} />
                <div className={`absolute -left-10 -bottom-10 h-32 w-32 rounded-full ${glowClass} blur-2xl`} />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-widest uppercase opacity-90">{tierName}</span>
                  <div className={`h-6 w-8 rounded ${score < 80 ? 'bg-black/5' : 'bg-white/10'} backdrop-blur-sm flex items-center justify-center font-bold text-[9px] opacity-40`}>
                    CHIP
                  </div>
                </div>

                <div className="my-5">
                  <p className={`text-[10px] uppercase tracking-wider ${labelClass}`}>Total Balance</p>
                  <p className="text-3xl font-extrabold tracking-tight mt-0.5">{formatIDR(balance)}</p>
                </div>

                <div className="flex items-end justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className={`text-[9px] uppercase tracking-wider ${subLabelClass}`}>Card Holder</p>
                    <p className="text-xs font-semibold tracking-wide truncate mt-0.5">{email || 'User Account'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-black italic tracking-tighter opacity-80">Voca</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Action Box: Top Up Panel */}
          <div className="rounded-xl border border-emerald-100 bg-white overflow-hidden shadow-sm">
            {/* Accent header strip */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-none">Isi Saldo</h3>
                <p className="text-[10px] text-emerald-100/80 mt-0.5">Pakasir Payment Gateway</p>
              </div>
            </div>

            <form onSubmit={handleTopup} className="p-5 space-y-3.5">
              <div>
                <label htmlFor="topup-amount" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Nominal Top Up
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-gray-400">Rp</span>
                  <input
                    type="text"
                    name="amount"
                    id="topup-amount"
                    placeholder="10.000"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(formatThousand(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-gray-800 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                    required
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">Minimum Rp 10.000</p>
              </div>

              {/* Preset amount pills */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pilih Nominal Cepat</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Rp 50k', value: 50000 },
                    { label: 'Rp 100k', value: 100000 },
                    { label: 'Rp 250k', value: 250000 },
                    { label: 'Rp 500k', value: 500000 },
                  ].map(({ label, value }) => {
                    const isSelected = topupAmount.replace(/\./g, '') === value.toString()
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTopupAmount(formatThousand(value.toString()))}
                        className={`py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {topupError && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 flex items-start gap-2">
                  <svg className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-red-600 font-medium">{topupError}</p>
                </div>
              )}

              {paymentSuccess && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 flex items-start gap-2">
                  <svg className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-emerald-700 font-medium">{paymentSuccess}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={topupLoading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 active:scale-[0.99] cursor-pointer"
              >
                {topupLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Top Up Sekarang
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Action Box: Withdraw Panel */}
          <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
            {/* Accent header strip */}
            <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-none">Tarik Dana</h3>
                <p className="text-[10px] text-indigo-100/80 mt-0.5">Transfer ke Bank / E-Wallet</p>
              </div>
            </div>

            <div className="p-5 space-y-3.5">
              {/* Balance info */}
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Saldo Dapat Ditarik</span>
                <span className="text-sm font-extrabold text-indigo-800">{formatIDR(balance)}</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Tarik saldo aktif langsung ke rekening bank atau e-wallet pilihanmu. Dana akan diproses admin dalam 1-2 hari kerja.
              </p>

              <button
                onClick={openWithdrawModal}
                disabled={balance < 10000}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-xs font-bold text-white transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm shadow-indigo-200 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
                {balance < 10000 ? 'Saldo Tidak Mencukupi' : 'Tarik Dana Sekarang'}
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5 text-xs text-blue-800 space-y-2">
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              <span>💡</span> Informasi Tambahan
            </p>
            <ul className="list-disc pl-4 space-y-1 text-blue-700">
              <li>Dana dari survey yang kamu isi akan langsung masuk ke Saldo Aktif.</li>
              <li>Untuk pembuat survey, saldo terkunci mewakili alokasi budget survey yang sedang berjalan.</li>
              <li>Tidak ada biaya admin tambahan untuk penarikan dana.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Withdraw Modal Overlay ───────────────────────────────────────── */}
      {withdrawStep !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeWithdrawModal() }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal panel */}
          <div
            ref={modalRef}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: 'modalSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Modal gradient header */}
            <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Tarik Dana</h2>
                  <p className="text-[10px] text-indigo-100/70">
                    {withdrawStep === 'amount' ? 'Langkah 1 dari 3 — Nominal' :  
                     withdrawStep === 'details' ? 'Langkah 2 dari 3 — Rekening Tujuan' :
                     withdrawStep === 'confirm' ? 'Langkah 3 dari 3 — Konfirmasi' :
                     withdrawStep === 'loading' ? 'Memproses permintaan...' :
                     withdrawStep === 'success' ? 'Penarikan Berhasil' : 'Gagal'}
                  </p>
                </div>
              </div>
              {withdrawStep !== 'loading' && (
                <button
                  onClick={closeWithdrawModal}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Step progress bar */}
            {['amount','details','confirm'].includes(withdrawStep) && (
              <div className="h-1 bg-indigo-100">
                <div
                  className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: withdrawStep === 'amount' ? '33%' : withdrawStep === 'details' ? '66%' : '100%' }}
                />
              </div>
            )}

            <div className="p-5">

              {/* ── Step 1: Amount ─────────────────────────────────────── */}
              {withdrawStep === 'amount' && (
                <div className="space-y-4">
                  {/* Balance chip */}
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Saldo Aktif</p>
                      <p className="text-xl font-extrabold text-indigo-800 mt-0.5">{formatIDR(balance)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>

                  {/* Amount input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nominal Penarikan</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-gray-400">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="10.000"
                        value={withdrawAmount}
                        onChange={(e) => { setWithdrawAmount(formatThousand(e.target.value)); setWithdrawError(null) }}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-gray-800 placeholder:text-gray-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                        autoFocus
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">Minimum Rp 10.000</p>
                  </div>

                  {/* Quick amount pills */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pilih Nominal Cepat</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[25000, 50000, 100000, 150000, 250000, 500000].map((val) => {
                        const isSelected = withdrawAmount.replace(/\./g, '') === val.toString()
                        const isDisabled = data ? val > data.balance : false
                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => { setWithdrawAmount(formatThousand(val.toString())); setWithdrawError(null) }}
                            className={`py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                              isDisabled
                                ? 'opacity-30 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400'
                                : isSelected
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-1 ring-indigo-200'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700'
                            }`}
                          >
                            {val >= 1000 ? `${val/1000}k` : val}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {withdrawError && <WithdrawErrorAlert message={withdrawError} />}

                  <button
                    onClick={handleWithdrawAmountNext}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
                  >
                    Lanjutkan
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* ── Step 2: Bank Details ───────────────────────────────── */}
              {withdrawStep === 'details' && (
                <div className="space-y-4">
                  {/* Bank / E-wallet selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Pilih Bank / E-Wallet</label>

                    {/* Bank section */}
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Bank</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {BANK_CHANNELS.filter(c => c.type === 'bank').map((ch) => (
                        <button
                          key={ch.code}
                          type="button"
                          onClick={() => { setWithdrawChannel(ch.code); setWithdrawError(null) }}
                          className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition-all cursor-pointer ${
                            withdrawChannel === ch.code
                              ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                              : 'border-gray-100 bg-gray-50 hover:border-indigo-200 hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg ${ch.color} flex items-center justify-center`}>
                            <span className="text-[8px] font-black text-white leading-none">{ch.label.slice(0,3).toUpperCase()}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-gray-600">{ch.label}</span>
                          {withdrawChannel === ch.code && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* E-wallet section */}
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">E-Wallet</p>
                    <div className="grid grid-cols-3 gap-2">
                      {BANK_CHANNELS.filter(c => c.type === 'ewallet').map((ch) => (
                        <button
                          key={ch.code}
                          type="button"
                          onClick={() => { setWithdrawChannel(ch.code); setWithdrawError(null) }}
                          className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition-all cursor-pointer ${
                            withdrawChannel === ch.code
                              ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                              : 'border-gray-100 bg-gray-50 hover:border-indigo-200 hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg ${ch.color} flex items-center justify-center`}>
                            <span className="text-[8px] font-black text-white leading-none">{ch.label.slice(0,3).toUpperCase()}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-gray-600">{ch.label}</span>
                          {withdrawChannel === ch.code && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account number */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      {BANK_CHANNELS.find(c => c.code === withdrawChannel)?.type === 'ewallet'
                        ? 'Nomor HP / Akun E-Wallet'
                        : 'Nomor Rekening'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={BANK_CHANNELS.find(c => c.code === withdrawChannel)?.type === 'ewallet' ? '08xxxxxxxxxx' : '0123456789'}
                      value={withdrawAccountNumber}
                      onChange={(e) => { setWithdrawAccountNumber(e.target.value); setWithdrawError(null) }}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm font-semibold text-gray-800 placeholder:text-gray-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>

                  {/* Account holder name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Nama Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      placeholder="Nama sesuai rekening"
                      value={withdrawAccountName}
                      onChange={(e) => setWithdrawAccountName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>

                  {withdrawError && <WithdrawErrorAlert message={withdrawError} />}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setWithdrawStep('amount'); setWithdrawError(null) }}
                      className="flex-1 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      ← Kembali
                    </button>
                    <button
                      onClick={handleWithdrawDetailsNext}
                      className="flex-2 flex-grow py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
                    >
                      Lanjutkan
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Confirm ────────────────────────────────────── */}
              {withdrawStep === 'confirm' && (() => {
                const channel = BANK_CHANNELS.find(c => c.code === withdrawChannel)
                const amt = parseInt(withdrawAmount.replace(/\./g, ''), 10)
                return (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
                      <ConfirmRow label="Nominal" value={formatIDR(amt)} valueClass="font-extrabold text-indigo-700 text-base" />
                      <ConfirmRow label="Bank / Dompet" value={
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-flex w-5 h-5 rounded ${channel?.color} items-center justify-center text-[7px] font-black text-white`}>
                            {channel?.label.slice(0,3).toUpperCase()}
                          </span>
                          {channel?.label}
                        </span>
                      } />
                      <ConfirmRow label="Nomor Rekening" value={withdrawAccountNumber} />
                      {withdrawAccountName && <ConfirmRow label="Nama Pemilik" value={withdrawAccountName} />}
                    </div>

                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 flex gap-2.5 items-start">
                      <svg className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        Pastikan data rekening <strong>sudah benar</strong>. Penarikan yang sudah diproses <strong>tidak bisa dibatalkan</strong>.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setWithdrawStep('details'); setWithdrawError(null) }}
                        className="flex-1 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                      >
                        ← Kembali
                      </button>
                      <button
                        onClick={handleWithdrawSubmit}
                        className="flex-grow py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Ya, Tarik Dana
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* ── Step: Loading ──────────────────────────────────────── */}
              {withdrawStep === 'loading' && (
                <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-violet-500 border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-indigo-50 flex items-center justify-center">
                      <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Memproses Penarikan</p>
                    <p className="text-xs text-gray-400 mt-1">Memproses permintaan penarikan...</p>
                  </div>
                </div>
              )}

              {/* ── Step: Success ──────────────────────────────────────── */}
              {withdrawStep === 'success' && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                    <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Permintaan Berhasil Diajukan!</p>
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-xs">{withdrawResult}</p>
                  </div>
                  <button
                    onClick={closeWithdrawModal}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-[0.99] cursor-pointer"
                  >
                    Selesai
                  </button>
                </div>
              )}

              {/* ── Step: Error ────────────────────────────────────────── */}
              {withdrawStep === 'error' && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center">
                    <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Penarikan Gagal</p>
                    <p className="text-xs text-red-600 mt-1.5 leading-relaxed">{withdrawError}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Saldo kamu telah dikembalikan secara otomatis.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closeWithdrawModal}
                      className="px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      Tutup
                    </button>
                    <button
                      onClick={openWithdrawModal}
                      className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-xs font-bold text-white hover:from-indigo-600 hover:to-violet-700 transition-all cursor-pointer"
                    >
                      Coba Lagi
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Modal slide-up animation */}
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </section>
  )
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function WithdrawErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 flex items-start gap-2">
      <svg className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-xs text-red-600 font-medium">{message}</p>
    </div>
  )
}

function ConfirmRow({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold text-gray-800 ${valueClass}`}>{value}</span>
    </div>
  )
}
