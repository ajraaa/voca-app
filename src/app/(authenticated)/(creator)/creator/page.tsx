'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CreatorDashboard from '@/components/creator/CreatorDashboard'
import SurveyCard from '@/components/creator/SurveyCard'
import { getMySurveys } from '@/services/survey.service'
import { Survey } from '@/types/survey.types'

export default function CreatorPage() {
  const [data, setData] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const json = await getMySurveys()
        if (!cancelled) setData(json.data || [])
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

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Creator Workspace</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">My Surveys</h1>
            <p className="mt-1 text-sm text-blue-100/80">
              Kelola, pantau, dan analisis semua surveymu di satu tempat.
            </p>
          </div>
          <Link
            href="/creator/create"
            id="create-survey-btn"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow transition-all hover:bg-blue-50 hover:shadow-md sm:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat Survey Baru
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600" />
            <p className="text-sm text-gray-400">Memuat data survey...</p>
          </div>
        </div>
      )}

      {/* Dashboard Metrics */}
      {!loading && !error && <CreatorDashboard />}

      {/* Error State */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="text-lg shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-red-800 text-sm">Gagal memuat data</p>
            <p className="text-red-600 text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">📋</div>
          <p className="text-lg font-bold text-gray-800">Belum ada survey</p>
          <p className="mt-1.5 max-w-xs text-sm text-gray-500">
            Buat survey pertamamu dan mulai kumpulkan respons dari ribuan responden.
          </p>
          <Link
            href="/creator/create"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat Survey Pertama
          </Link>
        </div>
      )}

      {/* Survey Grid */}
      {!loading && !error && data.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {data.length} Survey
            </h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {data.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
