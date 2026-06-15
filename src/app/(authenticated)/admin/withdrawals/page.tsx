'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/admin'

interface Withdrawal {
  id: string
  user_id: string
  external_id: string
  amount: number
  channel_code: string
  account_number: string
  account_holder_name: string | null
  status: string
  xendit_payout_id: string | null
  failure_reason: string | null
  created_at: string
  completed_at: string | null
  user_email: string
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdminWithdrawalsPage() {
  const router = useRouter()
  const [pageLoading, setPageLoading]   = useState(true)
  const [authorized, setAuthorized]     = useState(false)
  const [userEmail, setUserEmail]       = useState<string | null>(null)
  const [withdrawals, setWithdrawals]   = useState<Withdrawal[]>([])
  const [fetching, setFetching]         = useState(false)
  const [activeTab, setActiveTab]       = useState<'all' | 'pending' | 'success' | 'failed'>('all')
  const [search, setSearch]             = useState('')
  const [toast, setToast]               = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Modal
  const [selected, setSelected]   = useState<Withdrawal | null>(null)
  const [action, setAction]       = useState<'approve' | 'reject' | null>(null)
  const [refId, setRefId]         = useState('')
  const [reason, setReason]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!live) return
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email ?? null)
      if (isAdmin(user.email)) { setAuthorized(true); await load() }
      setPageLoading(false)
    })()
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setFetching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/withdrawals', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setWithdrawals(json.withdrawals ?? [])
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message })
    } finally {
      setFetching(false)
    }
  }

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !action) return
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          withdrawal_id: selected.id,
          action,
          ...(action === 'approve' ? { reference_id: refId.trim() || undefined } : { failure_reason: reason.trim() }),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Action failed')
      setToast({ type: 'ok', msg: json.message })
      closeModal()
      await load()
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  const openApprove = (w: Withdrawal) => { setSelected(w); setAction('approve'); setRefId(`TRF-${Date.now()}`) }
  const openReject  = (w: Withdrawal) => { setSelected(w); setAction('reject');  setReason('') }
  const closeModal  = () => { setSelected(null); setAction(null) }

  const pending  = withdrawals.filter(w => w.status === 'pending')
  const paid     = withdrawals.filter(w => w.status === 'success')
  const rejected = withdrawals.filter(w => w.status === 'failed')

  const filtered = withdrawals.filter(w => {
    if (activeTab === 'pending' && w.status !== 'pending')  return false
    if (activeTab === 'success' && w.status !== 'success')  return false
    if (activeTab === 'failed'  && w.status !== 'failed')   return false
    if (search) {
      const q = search.toLowerCase()
      return (
        w.user_email.toLowerCase().includes(q) ||
        w.account_number.includes(q) ||
        w.channel_code.toLowerCase().includes(q) ||
        (w.account_holder_name?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  /* ── Loading ── */
  if (pageLoading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600" />
        <p className="text-sm text-gray-400">Loading admin panel...</p>
      </div>
    </div>
  )

  /* ── Access denied ── */
  if (!authorized) return (
    <div className="mx-auto w-full max-w-md mt-12 text-center">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-10">
        <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-sm text-gray-500">
          <strong>{userEmail}</strong> is not authorised. Add this email to{' '}
          <code className="rounded bg-red-100 px-1 text-xs">ADMIN_EMAILS</code> in your{' '}
          <code className="rounded bg-red-100 px-1 text-xs">.env.local</code>.
        </p>
        <button onClick={() => router.push('/')} className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-all cursor-pointer">
          Go Home
        </button>
      </div>
    </div>
  )

  /* ── Dashboard ── */
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">

      {/* Hero header — same pattern as every other page */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Withdrawal Requests</h1>
            <p className="mt-1 text-sm text-blue-100/80">
              Review requests, transfer funds manually, then mark as paid or reject.
            </p>
          </div>
          <button
            onClick={load}
            disabled={fetching}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow transition-all hover:bg-blue-50 disabled:opacity-60 cursor-pointer sm:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold ${
          toast.type === 'ok'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {toast.type === 'ok'
            ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            : <span className="shrink-0 text-base">⚠️</span>
          }
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-lg leading-none opacity-50 hover:opacity-100 cursor-pointer">×</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Pending Transfer',  items: pending,  color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200' },
          { label: 'Total Paid Out',    items: paid,     color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'Rejected / Failed', items: rejected, color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200'   },
        ].map(({ label, items, color, bg, border }) => (
          <div key={label} className={`rounded-2xl border ${border} ${bg} p-5`}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
            <p className={`mt-2 text-2xl font-extrabold ${color}`}>
              {formatCurrency(items.reduce((s, w) => s + w.amount, 0))}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{items.length} request{items.length !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit">
            {([
              { key: 'all',     label: 'All',      count: withdrawals.length, active: 'bg-blue-600' },
              { key: 'pending', label: 'Pending',  count: pending.length,    active: 'bg-amber-500' },
              { key: 'success', label: 'Paid',     count: paid.length,       active: 'bg-green-600' },
              { key: 'failed',  label: 'Rejected', count: rejected.length,   active: 'bg-red-600'   },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === t.key ? `${t.active} text-white shadow-sm` : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search email, account..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-64 rounded-xl border border-gray-200 py-2 pl-9 pr-4 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
            />
          </div>
        </div>

        {/* Loading */}
        {fetching && withdrawals.length === 0 && (
          <div className="flex h-48 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600" />
              <p className="text-sm text-gray-400">Loading transactions...</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!fetching && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 text-2xl">💸</div>
            <p className="font-semibold text-gray-700">No withdrawals found</p>
            <p className="mt-1 text-sm text-gray-400">Try adjusting your filters or search query.</p>
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['User / Date', 'Destination', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">

                    {/* User / Date */}
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-gray-900 truncate max-w-[180px]" title={w.user_email}>{w.user_email}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(w.created_at)}</p>
                    </td>

                    {/* Destination */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">{w.channel_code}</span>
                        <span className="font-mono text-xs font-semibold text-gray-800 select-all">{w.account_number}</span>
                      </div>
                      {w.account_holder_name && (
                        <p className="mt-0.5 text-[11px] text-gray-400">a/n {w.account_holder_name}</p>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(w.amount)}</td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {w.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />Pending
                        </span>
                      )}
                      {w.status === 'success' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[11px] font-bold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />Paid
                        </span>
                      )}
                      {w.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {w.status === 'pending' ? (
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => openApprove(w)} className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-green-700 transition-all cursor-pointer">
                            Mark Paid
                          </button>
                          <button onClick={() => openReject(w)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 transition-all cursor-pointer">
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-gray-400">
                          {w.status === 'success' ? 'Settled' : 'Refunded'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {action && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-extrabold text-gray-900">
                {action === 'approve' ? 'Confirm Payout' : 'Reject Withdrawal'}
              </h3>
              <button onClick={closeModal} className="text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer">×</button>
            </div>

            <form onSubmit={submitAction} className="p-6 space-y-5">
              {/* Summary */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-xs">
                {[
                  ['User',        selected.user_email],
                  ['Amount',      formatCurrency(selected.amount)],
                  ['Destination', `${selected.channel_code.toUpperCase()} · ${selected.account_number}`],
                  ...(selected.account_holder_name ? [['Name', `a/n ${selected.account_holder_name}`]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="shrink-0 font-semibold text-gray-400">{k}</span>
                    <span className={`font-bold text-right truncate ${k === 'Amount' ? 'text-blue-600' : 'text-gray-800'}`}>{v}</span>
                  </div>
                ))}
              </div>

              {action === 'approve' ? (
                <div className="space-y-1.5">
                  <label htmlFor="ref" className="block text-xs font-bold text-gray-600">Transfer Reference ID</label>
                  <input
                    id="ref"
                    type="text"
                    required
                    value={refId}
                    onChange={e => setRefId(e.target.value)}
                    placeholder="e.g. TRF-1234567890"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="text-[11px] text-gray-400">Stored as audit trail. Use the receipt number from your bank app.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="reason" className="block text-xs font-bold text-gray-600">Rejection Reason</label>
                  <textarea
                    id="reason"
                    required
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. Nomor rekening tidak valid"
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-800 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                  <p className="text-[11px] text-gray-400">The user's locked balance will be immediately refunded.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-60 cursor-pointer transition-all ${
                    action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting && (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {action === 'approve' ? 'Confirm Payout' : 'Reject & Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
