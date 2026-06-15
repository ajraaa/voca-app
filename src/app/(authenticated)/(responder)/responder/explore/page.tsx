'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSurveys } from '@/services/survey.service'
import { supabase } from '@/lib/supabase'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

type IncompleteField = 'Gender' | 'Usia' | 'Pekerjaan'

export default function ExploreSurveysPage() {
  const [surveys, setSurveys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incompleteFields, setIncompleteFields] = useState<IncompleteField[]>([])
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        const [result, profileRes] = await Promise.all([
          getSurveys(),
          token
            ? fetch('/api/profile', {
                headers: { Authorization: `Bearer ${token}` },
              }).then((r) => r.ok ? r.json() : null)
            : Promise.resolve(null),
        ])

        if (!cancelled) {
          setSurveys(result.data || [])

          if (profileRes?.data) {
            const p = profileRes.data
            const missing: IncompleteField[] = []
            if (!p.gender) missing.push('Gender')
            if (p.age === null || p.age === undefined) missing.push('Usia')
            if (!p.job) missing.push('Pekerjaan')
            setIncompleteFields(missing)
          }
        }
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

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl animate-pulse">
        {/* Header */}
        <div className="mb-6 space-y-2">
          <div className="h-7 w-28 rounded-lg bg-gray-200" />
          <div className="h-4 w-56 rounded bg-gray-100" />
        </div>

        {/* Survey card skeletons */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex justify-between items-start">
                <div className="h-5 w-14 rounded-full bg-emerald-100" />
                <div className="h-4 w-10 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-3/4 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-full rounded bg-gray-100 mb-1" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                <div className="h-3 w-32 rounded bg-gray-100" />
                <div className="h-3 w-24 rounded bg-emerald-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cari Survey</h1>
        <p className="text-sm text-gray-500">Daftar survey yang tersedia untukmu.</p>
      </div>

      {/* Incomplete profile banner */}
      {!bannerDismissed && incompleteFields.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 shadow-sm">
          <span className="shrink-0 text-lg mt-0.5">🎯</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Lengkapi profilmu untuk melihat lebih banyak survey!
            </p>
            <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
              Beberapa survey hanya ditampilkan untuk responden dengan profil yang sesuai.
              Profil yang belum diisi:&nbsp;
              {incompleteFields.map((field, i) => (
                <span key={field}>
                  <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    {field}
                  </span>
                  {i < incompleteFields.length - 1 && <span className="mx-1 text-amber-500">·</span>}
                </span>
              ))}
            </p>
            <Link
              href="/responder/profile"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 transition-colors"
            >
              Lengkapi profil sekarang →
            </Link>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 p-1 text-amber-400 hover:text-amber-600 transition-colors rounded-md hover:bg-amber-100 cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center shadow-sm mb-6">
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Empty state */}
      {!error && surveys.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mx-auto mb-4">
            📭
          </div>
          <p className="text-lg font-semibold text-gray-700">Belum ada survey</p>
          <p className="mt-1 text-sm text-gray-500">
            Tidak ada survey aktif saat ini. Cek lagi nanti!
          </p>
        </div>
      )}

      {/* Survey Grid */}
      {!error && surveys.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {surveys.map((survey) => (
            <Link
              href={`/surveys/${survey.id}`}
              key={survey.id}
              className="block bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group overflow-hidden"
            >
              {/* Card accent strip */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

              <div className="p-6">
                {/* Status row */}
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                  <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2.5 py-0.5 rounded-full">
                    {survey.remaining_responses} tersisa
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="text-base font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors"
                  title={survey.title}
                >
                  {survey.title || `Survey ${survey.id?.substring(0, 8)}...`}
                </h3>

                {/* Description */}
                {survey.description && (
                  <p
                    className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed"
                    title={survey.description}
                  >
                    {survey.description}
                  </p>
                )}

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    ID: {survey.creator_id?.substring(0, 8)}...
                  </span>
                  {survey.reward_per_response && (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      💰 {formatCurrency(survey.reward_per_response)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
