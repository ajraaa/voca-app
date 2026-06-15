'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ResponderDashboard from '@/components/responder/ResponderDashboard'
import ResponseCard from '@/components/responder/ResponseCard'
import { getMyResponses } from '@/services/response.service'

export default function ResponderPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const res = await getMyResponses()
        if (!cancelled) setData(res.data || [])
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const draftResponses = data.filter((r) => r.status === 'draft')
  const submittedResponses = data.filter((r) => r.status !== 'draft')

  const validCount = submittedResponses.filter((r: any) => r.status === 'valid').length
  const lowQualityCount = submittedResponses.filter((r: any) => r.status === 'low_quality').length
  const rejectedCount = submittedResponses.filter((r: any) => r.status === 'rejected').length
  const totalEarnings = submittedResponses.reduce((acc: number, r: any) => acc + (r.reward_final || 0), 0)
  const totalFee = totalEarnings * 0.05
  const totalNet = totalEarnings - totalFee
  const scored = submittedResponses.filter((r: any) => r.score !== null && r.score !== undefined)
  const averageScore = scored.length > 0
    ? scored.reduce((acc: number, r: any) => acc + r.score, 0) / scored.length
    : null

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl animate-pulse">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 rounded-lg bg-gray-200" />
            <div className="h-4 w-64 rounded bg-gray-100" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-gray-200" />
        </div>

        {/* Dashboard overview card skeleton */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-40 rounded bg-gray-200 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-24 rounded-xl bg-green-50 border border-green-100" />
            <div className="h-24 rounded-xl bg-blue-50 border border-blue-100" />
            <div className="h-24 rounded-xl bg-yellow-50 border border-yellow-100" />
          </div>
          <div className="border-t border-gray-100 pt-5">
            <div className="h-4 w-32 rounded bg-gray-200 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-50 border border-gray-200" />
              ))}
            </div>
            <div className="mt-4 h-14 rounded-lg bg-gray-50 border border-gray-200" />
          </div>
        </div>

        {/* Response card skeletons */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                </div>
                <div className="h-6 w-20 rounded-full bg-gray-100" />
              </div>
              <div className="mt-4 flex gap-3">
                <div className="h-8 w-24 rounded-lg bg-gray-100" />
                <div className="h-8 w-24 rounded-lg bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Respons</h1>
          <p className="text-sm text-gray-500">Daftar survey yang telah kamu kerjakan.</p>
        </div>
        <Link
          href="/responder/explore"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Cari Survey Lain
        </Link>
      </div>

      {!error && (
        <ResponderDashboard
          totalEarnings={totalEarnings}
          totalFee={totalFee}
          totalNet={totalNet}
          totalCompleted={submittedResponses.length}
          totalDraft={draftResponses.length}
          validCount={validCount}
          lowQualityCount={lowQualityCount}
          rejectedCount={rejectedCount}
          averageScore={averageScore}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && data.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-lg font-semibold text-gray-700">Belum ada respons</p>
          <p className="mt-1 text-sm text-gray-500">
            Kamu belum mengerjakan survey apapun. Yuk mulai cari survey!
          </p>
          <Link
            href="/responder/explore"
            className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Cari Survey
          </Link>
        </div>
      )}

      {/* Drafts */}
      {!error && draftResponses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Survey Disimpan (Draft)</h2>
          <div className="space-y-4">
            {draftResponses.map((r) => (
              <ResponseCard key={r.id} response={r} isDraft />
            ))}
          </div>
        </div>
      )}

      {/* Submitted */}
      {!error && submittedResponses.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Survey Selesai</h2>
          <div className="space-y-4">
            {submittedResponses.map((r) => (
              <ResponseCard key={r.id} response={r} isDraft={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
