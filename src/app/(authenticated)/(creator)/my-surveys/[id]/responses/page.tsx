'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSurveyResponses, getMySurveys } from '@/services/survey.service'

interface Answer {
    question_id: string
    question_text: string
    question_type: string
    is_attention_check: boolean
    answer_text: string | null
    option_id: string | null
    option_text: string | null
    is_correct: boolean | null
}

interface ResponseEntry {
    id: string
    respondent_number: number
    user_id: string
    created_at: string
    score: number | null
    status: string | null
    answers: Answer[]
}

export default function SurveyResponsesPage() {
    const params = useParams()
    const router = useRouter()
    const surveyId = params.id as string

    const [survey, setSurvey] = useState<any>(null)
    const [responses, setResponses] = useState<ResponseEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedResponse, setSelectedResponse] = useState<ResponseEntry | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [surveyJson, responsesJson] = await Promise.all([
                    getMySurveys(),
                    getSurveyResponses(surveyId)
                ])

                const found = surveyJson.data.find((s: any) => s.id === surveyId)
                if (!found) {
                    setError('Survey tidak ditemukan atau Anda tidak memiliki akses.')
                    return
                }

                setSurvey(found)
                setResponses(responsesJson.data || [])
            } catch (err: any) {
                setError(err.message || 'Terjadi kesalahan saat memuat data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [surveyId])

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const getStatusBadge = (status: string | null) => {
        if (status === 'valid') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✅ Valid</span>
        if (status === 'low_quality') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">❌ Low Quality</span>
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">— Pending</span>
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                <Link
                    href={`/my-surveys/${surveyId}`}
                    className="text-blue-600 text-sm hover:underline mb-4 inline-block"
                >
                    ← Kembali ke Detail Survey
                </Link>

                {loading && (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full" />
                    </div>
                )}

                {!loading && error && (
                    <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg mt-4">
                        {error}
                    </div>
                )}

                {!loading && survey && (
                    <>
                        {/* Header */}
                        <div className="bg-white p-6 rounded-xl border shadow-sm mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
                            <p className="text-sm text-gray-500 mt-1">Data Responses Survey</p>
                            <div className="mt-4 flex gap-6 text-sm text-gray-700">
                                <div>
                                    <span className="text-gray-400">Total Responden</span>
                                    <p className="font-bold text-xl text-blue-600">{responses.length}</p>
                                </div>
                                <div>
                                    <span className="text-gray-400">Valid</span>
                                    <p className="font-bold text-xl text-green-600">{responses.filter(r => r.status === 'valid').length}</p>
                                </div>
                                <div>
                                    <span className="text-gray-400">Low Quality</span>
                                    <p className="font-bold text-xl text-red-500">{responses.filter(r => r.status === 'low_quality').length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-6">
                            {/* Tabel Kiri */}
                            <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden">
                                {responses.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <p className="text-3xl mb-2">📭</p>
                                        <p className="text-sm">Belum ada response yang masuk.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600">Skor</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {responses.map((r) => (
                                                <tr
                                                    key={r.id}
                                                    onClick={() => setSelectedResponse(selectedResponse?.id === r.id ? null : r)}
                                                    className={`border-b cursor-pointer transition-colors ${selectedResponse?.id === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="px-4 py-3 font-medium text-gray-700">#{r.respondent_number}</td>
                                                    <td className="px-4 py-3 text-gray-500">{formatDate(r.created_at)}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-800">{r.score ?? '—'}</td>
                                                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Detail Panel Kanan */}
                            {selectedResponse && (
                                <div className="w-80 shrink-0">
                                    <div className="bg-white rounded-xl border shadow-sm p-4 sticky top-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="font-semibold text-gray-900">
                                                Jawaban Responden #{selectedResponse.respondent_number}
                                            </h2>
                                            <button
                                                onClick={() => setSelectedResponse(null)}
                                                className="text-gray-400 hover:text-gray-600 text-lg"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="text-xs text-gray-500 mb-4 space-y-0.5">
                                            <p>Tanggal: {formatDate(selectedResponse.created_at)}</p>
                                            <p className="flex items-center gap-2">Status: {getStatusBadge(selectedResponse.status)}</p>
                                            {selectedResponse.score !== null && (
                                                <p>Skor: <span className="font-semibold text-gray-700">{selectedResponse.score}</span></p>
                                            )}
                                        </div>

                                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                            {selectedResponse.answers.map((a, i) => (
                                                <div key={a.question_id} className={`p-3 rounded-lg border text-xs ${a.is_attention_check ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                                                    <div className="flex items-start gap-1 mb-1">
                                                        {a.is_attention_check && (
                                                            <span className="text-amber-600 shrink-0">🛡️</span>
                                                        )}
                                                        <p className="font-medium text-gray-700">{i + 1}. {a.question_text}</p>
                                                    </div>

                                                    <div className="mt-1.5 pl-2">
                                                        {a.question_type === 'text' ? (
                                                            <p className="text-gray-600 italic">{a.answer_text || '—'}</p>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                {a.is_attention_check && (
                                                                    <span>{a.is_correct ? '✅' : '❌'}</span>
                                                                )}
                                                                <span className={`${a.is_attention_check && !a.is_correct ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                                                    {a.option_text || '—'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
