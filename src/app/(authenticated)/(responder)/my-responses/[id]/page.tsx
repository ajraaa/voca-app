'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getResponseById } from '@/services/response.service'

function formatDuration(seconds: number) {
  if (!seconds || seconds < 0) return '0s'
  const sec = Math.floor(seconds)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m ${s}s`
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)

function statusStyle(status: string) {
  switch (status) {
    case 'valid':
      return { pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', label: 'Valid' }
    case 'low_quality':
      return { pill: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', label: 'Low Quality' }
    case 'rejected':
      return { pill: 'bg-red-100 text-red-800', dot: 'bg-red-500', label: 'Rejected' }
    default:
      return { pill: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status || 'Pending' }
  }
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-gray-400'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export default function ResponseDetail() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      try {
        const res = await getResponseById(id)
        setData(res.data)
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat memuat detail respons.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl animate-pulse">
        <div className="mb-6 h-5 w-44 rounded bg-gray-200" />

        {/* Header card skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
          <div className="h-1.5 bg-gradient-to-r from-gray-200 to-gray-100" />
          <div className="p-6 md:p-8 space-y-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-7 w-2/3 rounded-lg bg-gray-200" />
                <div className="h-4 w-1/2 rounded bg-gray-100" />
                <div className="h-3 w-36 rounded bg-gray-100" />
              </div>
              <div className="h-7 w-20 rounded-full bg-gray-200 ml-4" />
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
              {[
                'border-emerald-100 bg-emerald-50',
                'border-blue-100 bg-blue-50',
                'border-amber-100 bg-amber-50',
                'border-gray-200 bg-gray-50',
              ].map((accent, i) => (
                <div key={i} className={`rounded-xl border p-4 flex flex-col gap-2 ${accent}`}>
                  <div className="h-3 w-16 rounded bg-current opacity-20" />
                  <div className="h-6 w-24 rounded-md bg-current opacity-25" />
                </div>
              ))}
            </div>
            {/* Breakdown skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200" />
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-32 rounded bg-gray-100" />
                    <div className="h-3 w-8 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                    <div className="h-4 w-20 rounded bg-gray-200" />
                    <div className="h-3 w-32 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Answers skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-gray-200 to-gray-100" />
          <div className="p-6 md:p-8 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-5 border border-gray-100 rounded-xl bg-gray-50 space-y-3">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-10 rounded-lg bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <section className="mx-auto w-full max-w-6xl">
        <Link
          href="/responder"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-emerald-600 transition-colors mb-8 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Kembali ke Riwayat Respons
        </Link>
        <div className="rounded-2xl border border-red-100 bg-white shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-red-400 to-rose-500" />
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100 text-red-500">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Gagal Memuat Data</h2>
            <p className="text-sm text-gray-500 mb-6">{error || 'Data tidak ditemukan.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </section>
    )
  }

  const groupedAnswers = Object.values(
    (data?.answers || []).reduce((acc: any, current: any) => {
      if (!acc[current.question_id]) {
        acc[current.question_id] = {
          ...current,
          options: current.option_text ? [current.option_text] : [],
        }
      } else if (current.option_text) {
        acc[current.question_id].options.push(current.option_text)
      }
      return acc
    }, {})
  ) as any[]

  // Normalize score_breakdown — Supabase JSONB can arrive as a string
  const rawBreakdown = data.score_breakdown
  const scoreBreakdown: Record<string, any> | null = (() => {
    if (!rawBreakdown) return null
    if (typeof rawBreakdown === 'string') {
      try { return JSON.parse(rawBreakdown) } catch { return null }
    }
    if (typeof rawBreakdown === 'object') return rawBreakdown
    return null
  })()

  const hasBreakdown =
    scoreBreakdown !== null &&
    typeof scoreBreakdown === 'object' &&
    Object.keys(scoreBreakdown).length > 0

  const { pill, dot, label } = statusStyle(data.status)

  return (
    <section className="mx-auto w-full max-w-6xl">
      {/* Back link */}
      <Link
        href="/responder"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-emerald-600 transition-colors mb-6 group"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span> Kembali ke Riwayat Respons
      </Link>

      {/* Header Card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
        {/* Accent strip */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-emerald-100/80 uppercase tracking-widest font-bold">Detail Respons</p>
              <h1 className="text-base font-bold text-white leading-tight line-clamp-1">
                {data.survey?.title || 'Untitled Survey'}
              </h1>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        </div>

        <div className="p-6 md:p-8">
          {/* Survey description */}
          {data.survey?.description && (
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{data.survey.description}</p>
          )}

          {/* Submitted at */}
          <p className="text-xs text-gray-400 mb-6">
            Dikerjakan pada:{' '}
            <span className="font-semibold text-gray-600">
              {new Date(data.created_at).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>

          {/* Stat mini-cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 pt-5">
            {/* Score */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 p-4 rounded-xl border border-blue-200/50 shadow-sm">
              <p className="text-blue-700 text-xs font-semibold uppercase tracking-wider mb-1">Skor</p>
              <p className={`text-2xl font-extrabold ${scoreColor(data.score)}`}>
                {data.score !== null ? data.score : '—'}
              </p>
            </div>

            {/* Reward Final */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-4 rounded-xl border border-emerald-200/50 shadow-sm">
              <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">Reward Diterima</p>
              <p className={`text-lg font-extrabold ${data.reward_final > 0 ? 'text-emerald-800' : 'text-gray-500'}`}>
                {formatIDR(data.reward_final || 0)}
              </p>
              {data.reward_final !== data.survey?.reward && data.survey?.reward > 0 && (
                <p className="text-[10px] text-gray-400 line-through mt-0.5">
                  {formatIDR(data.survey.reward)}
                </p>
              )}
            </div>

            {/* Duration */}
            {hasBreakdown && (
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 p-4 rounded-xl border border-amber-200/50 shadow-sm">
                <p className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-1">Durasi</p>
                <p className="text-lg font-extrabold text-amber-900">
                  {formatDuration(scoreBreakdown!.duration)}
                </p>
                {scoreBreakdown!.duration >= scoreBreakdown!.min_duration ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">Normal ✅</span>
                ) : (
                  <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">Terlalu cepat ❌</span>
                )}
              </div>
            )}

            {/* Attention Check */}
            {hasBreakdown && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/40 p-4 rounded-xl border border-gray-200/50 shadow-sm">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Attention Check</p>
                <p className="text-sm font-bold text-gray-800">
                  {scoreBreakdown!.attention_check === 'passed' ? (
                    <span className="text-emerald-600">Passed ✅</span>
                  ) : scoreBreakdown!.attention_check === 'failed' ? (
                    <span className="text-red-600">Failed ❌</span>
                  ) : (
                    <span className="capitalize text-gray-500">{scoreBreakdown!.attention_check || 'N/A'}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Score Breakdown */}
          {hasBreakdown && (
            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Breakdown ledger */}
              <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 flex items-center gap-2">
                  <span className="text-base">🧮</span>
                  <h3 className="text-sm font-bold text-white">Score Breakdown</h3>
                </div>
                <div className="p-4 space-y-2 text-sm font-mono">
                  <div className="flex justify-between text-gray-700">
                    <span>+ Base Score</span>
                    <span className="font-bold">{scoreBreakdown!.base || 0}</span>
                  </div>
                  {(scoreBreakdown!.time_penalty || 0) !== 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>− Time Penalty ({formatDuration(scoreBreakdown!.duration)})</span>
                      <span className="font-bold">{Math.abs(scoreBreakdown!.time_penalty)}</span>
                    </div>
                  )}
                  {(scoreBreakdown!.essay_penalty || 0) !== 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>− Essay Penalty</span>
                      <span className="font-bold">{Math.abs(scoreBreakdown!.essay_penalty)}</span>
                    </div>
                  )}
                  {(scoreBreakdown!.reputation_bonus || 0) !== 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>+ Reputation Bonus</span>
                      <span className="font-bold">{scoreBreakdown!.reputation_bonus}</span>
                    </div>
                  )}
                  {(scoreBreakdown!.reputation_penalty || 0) !== 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>− Reputation Penalty</span>
                      <span className="font-bold">{Math.abs(scoreBreakdown!.reputation_penalty)}</span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between font-extrabold text-gray-900">
                    <span>Final Score</span>
                    <span className={scoreColor(scoreBreakdown!.final_score ?? data.score)}>
                      {scoreBreakdown!.final_score ?? data.score}
                    </span>
                  </div>
                </div>
              </div>

              {/* Side info cards */}
              <div className="space-y-3">
                {/* Duration detail */}
                <div className="rounded-xl border border-amber-100 bg-white overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-sm">⏱️</span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Duration</h3>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-700 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{formatDuration(scoreBreakdown!.duration)}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-xs text-gray-500">Min: {formatDuration(scoreBreakdown!.min_duration)}</span>
                    {scoreBreakdown!.duration >= scoreBreakdown!.min_duration ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Normal ✅</span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Too fast ❌</span>
                    )}
                  </div>
                </div>

                {/* Attention check */}
                <div className="rounded-xl border border-purple-100 bg-white overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-purple-500 to-violet-600 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-sm">🧠</span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Attention Check</h3>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-700">
                    {scoreBreakdown!.attention_check === 'passed' ? (
                      <span className="font-semibold text-emerald-600">Passed ✅</span>
                    ) : scoreBreakdown!.attention_check === 'failed' ? (
                      <span className="font-semibold text-red-600">Failed ❌</span>
                    ) : (
                      <span className="capitalize text-gray-500">{scoreBreakdown!.attention_check || 'N/A'}</span>
                    )}
                  </div>
                </div>

                {/* Reputation */}
                <div className="rounded-xl border border-yellow-100 bg-white overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-sm">⭐</span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reputation</h3>
                  </div>
                  <div className="px-4 py-3 text-sm">
                    {scoreBreakdown!.reputation_bonus > 0 ? (
                      <span className="font-semibold text-emerald-600">+{scoreBreakdown!.reputation_bonus} Bonus</span>
                    ) : scoreBreakdown!.reputation_penalty > 0 ? (
                      <span className="font-semibold text-red-600">−{scoreBreakdown!.reputation_penalty} Penalty</span>
                    ) : (
                      <span className="text-gray-500">No impact</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Answers Section */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Accent strip */}
        <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">Jawaban Anda</h2>
            <p className="text-[10px] text-indigo-100/80 mt-0.5">{groupedAnswers.length} jawaban tercatat</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {groupedAnswers.length > 0 ? (
            <div className="space-y-4">
              {groupedAnswers.map((answer: any, index: number) => (
                <div
                  key={answer.question_id}
                  className="p-5 border border-gray-100 rounded-xl bg-gray-50/80 hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors"
                >
                  <p className="text-sm font-semibold text-gray-900 mb-3 flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    {answer.question_text}
                  </p>
                  <div className="ml-8 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed">
                    {answer.question_type === 'radio' || answer.question_type === 'checkbox'
                      ? (answer.options?.length > 0
                          ? answer.options.map((opt: string, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 mr-2 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                {opt}
                              </span>
                            ))
                          : answer.answer_text || <span className="text-gray-400 italic">Tidak ada jawaban</span>)
                      : answer.answer_text || <span className="text-gray-400 italic">Tidak ada jawaban</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-3">
                📭
              </div>
              <p className="text-sm font-semibold text-gray-600">Tidak ada detail jawaban tersedia.</p>
              <p className="text-xs text-gray-400 mt-1">Jawaban mungkin belum disimpan atau tidak tersedia.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
