'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getMySurveys, getSurveyQuestions, getSurveyInsight, getSurveyBurnRate, getSurveyTargeting, updateSurveyTargeting } from '@/services/survey.service'
import { generateSurveyInsight } from '@/lib/survey-insight'
import { getEstimationSummary } from '@/lib/survey-estimation'
import { computeRewardRecommendation, type QuestionLike } from '@/lib/reward-recommendation'
import QuestionItem from '@/components/creator/QuestionItem'
import { Question } from '@/types/survey.types'

const JOB_OPTIONS = [
    'Mahasiswa', 'Pelajar', 'Karyawan', 'Freelancer', 'Wirausaha',
    'Ibu rumah tangga', 'PNS', 'Profesional', 'Tidak bekerja', 'Lainnya',
]

type SurveyTargeting = {
    gender: string | null
    age_min: number | null
    age_max: number | null
    jobs: string[] | null
}

type SurveyBurnRate = {
    completed_responses: number
    remaining_responses: number
    responses_per_minute: number
    estimated_minutes_to_finish: number | null
    has_enough_data: boolean
    locked_budget: number
    reward_per_response: number
    total_spent: number
    remaining_budget: number
    budget_used_percent: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    draft:     { label: 'Draft',     color: 'text-slate-600',  bg: 'bg-slate-100',   border: 'border-slate-200', dot: 'bg-slate-400' },
    active:    { label: 'Aktif',     color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
    paused:    { label: 'Dijeda',    color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-200', dot: 'bg-amber-500' },
    completed: { label: 'Selesai',   color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-200', dot: 'bg-blue-500' },
}

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
            {cfg.label}
        </span>
    )
}

export default function SurveyDetailPage() {
    const params = useParams()
    const router = useRouter()
    const surveyId = params.id as string

    const [survey, setSurvey] = useState<any>(null)
    const [questions, setQuestions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isEditingInfo, setIsEditingInfo] = useState(false)
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [isSavingInfo, setIsSavingInfo] = useState(false)
    const [isEditingReward, setIsEditingReward] = useState(false)
    const [editReward, setEditReward] = useState<number | ''>('')
    const [isSavingReward, setIsSavingReward] = useState(false)
    const [isChangingStatus, setIsChangingStatus] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showPublishModal, setShowPublishModal] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [publishSuccessWarning, setPublishSuccessWarning] = useState<string | null>(null)
    const [rewardEval, setRewardEval] = useState<{
        hardOk: boolean
        softOk: boolean
        minRequired: number
        recommended: number
        rewardPerResponse: number
        questionCount: number
        estimatedMinutesTotal: number
        hardMessage?: string
        softWarning?: string
    } | null>(null)
    const [insightData, setInsightData] = useState<any>(null)
    const [burnRate, setBurnRate] = useState<SurveyBurnRate | null>(null)

    // Targeting state
    const [targeting, setTargeting] = useState<SurveyTargeting | null>(null)
    const [isEditingTargeting, setIsEditingTargeting] = useState(false)
    const [editTargetGender, setEditTargetGender] = useState<string | null>(null)
    const [editTargetAgeMin, setEditTargetAgeMin] = useState<number | ''>('')
    const [editTargetAgeMax, setEditTargetAgeMax] = useState<number | ''>('')
    const [editTargetJobs, setEditTargetJobs] = useState<string[]>([])
    const [isSavingTargeting, setIsSavingTargeting] = useState(false)

    useEffect(() => {
        const fetchSurvey = async () => {
            try {
                const json = await getMySurveys()
                const found = json.data.find((s: any) => s.id === surveyId)

                if (!found) {
                    setError('Survey tidak ditemukan')
                } else {
                    setSurvey(found)
                    setEditTitle(found.title || '')
                    setEditDescription(found.description || '')

                    try {
                        const qJson = await getSurveyQuestions(surveyId)
                        setQuestions(qJson.data || [])
                    } catch (qErr) {
                        console.error('Failed to fetch questions:', qErr)
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Terjadi kesalahan')
            } finally {
                setLoading(false)
            }
        }

        fetchSurvey()
    }, [surveyId])

    useEffect(() => {
        if (!surveyId || survey?.status !== 'draft') {
            setRewardEval(null)
            return
        }
        if (!survey || questions.length === 0) return

        const questionList: QuestionLike[] = questions.map((q: any) => ({
            question_type: q.question_type,
        }))

        const { min_required, recommended } = computeRewardRecommendation(
            Number(survey.total_responses) || 1,
            questionList
        )

        const currentReward = Number(survey.reward_per_response) || 0

        setRewardEval({
            hardOk: currentReward >= min_required,
            softOk: currentReward >= recommended,
            minRequired: min_required,
            recommended,
            rewardPerResponse: currentReward,
            questionCount: questions.length,
            estimatedMinutesTotal: questions.length * 1.5,
            hardMessage: currentReward < min_required
                ? `Minimum reward adalah Rp ${min_required.toLocaleString('id-ID')} untuk survey ini.`
                : undefined,
            softWarning: currentReward >= min_required && currentReward < recommended
                ? 'Reward di bawah rekomendasi platform.'
                : undefined,
        })
    }, [surveyId, survey?.status, survey?.reward_per_response, survey?.total_responses, questions])

    useEffect(() => {
        if (!surveyId || survey?.status !== 'completed') {
            setInsightData(null)
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    const json = await getSurveyInsight(surveyId)
                    if (!cancelled && json.data) {
                        setInsightData(json.data)
                    }
                } catch {
                    if (!cancelled) setInsightData(null)
                }
            })()
        return () => { cancelled = true }
    }, [surveyId, survey?.status])

    useEffect(() => {
        if (!surveyId || !survey) return

        let cancelled = false
            ; (async () => {
                try {
                    const json = await getSurveyBurnRate(surveyId)
                    if (!cancelled) {
                        setBurnRate(json.data || null)
                    }
                } catch (err) {
                    console.error('Failed to fetch burn rate:', err)
                    if (!cancelled) setBurnRate(null)
                }
            })()

        return () => { cancelled = true }
    }, [surveyId, survey?.status, survey?.remaining_responses])

    // Fetch targeting data
    useEffect(() => {
        if (!surveyId || !survey) return
        let cancelled = false
        ;(async () => {
            try {
                const json = await getSurveyTargeting(surveyId)
                if (!cancelled) {
                    setTargeting(json.data ?? null)
                }
            } catch {
                if (!cancelled) setTargeting(null)
            }
        })()
        return () => { cancelled = true }
    }, [surveyId, survey])

    const handleStartEditTargeting = () => {
        setEditTargetGender(targeting?.gender ?? null)
        setEditTargetAgeMin(targeting?.age_min ?? '')
        setEditTargetAgeMax(targeting?.age_max ?? '')
        setEditTargetJobs(targeting?.jobs ?? [])
        setIsEditingTargeting(true)
    }

    const handleCancelTargeting = () => {
        setIsEditingTargeting(false)
    }

    const handleSaveTargeting = async () => {
        setIsSavingTargeting(true)
        try {
            const result = await updateSurveyTargeting(surveyId, {
                gender: editTargetGender,
                age_min: editTargetAgeMin !== '' ? Number(editTargetAgeMin) : null,
                age_max: editTargetAgeMax !== '' ? Number(editTargetAgeMax) : null,
                jobs: editTargetJobs,
            })
            setTargeting(result.data ?? null)
            setIsEditingTargeting(false)
        } catch (err: any) {
            alert(err.message || 'Gagal menyimpan targeting')
        } finally {
            setIsSavingTargeting(false)
        }
    }

    const handleDeleteQuestion = async (questionId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus pertanyaan ini?')) return;

        try {
            const { deleteSurveyQuestion } = await import('@/services/survey.service');
            await deleteSurveyQuestion(surveyId, questionId);

            setQuestions(prev => prev.filter(q => q.id !== questionId));
        } catch (err: any) {
            alert(err.message || 'Gagal menghapus pertanyaan');
        }
    }

    const handleEditQuestion = (questionId: string) => {
        router.push(`/my-surveys/${surveyId}/edit-question/${questionId}`);
    }

    const handlePublish = () => {
        setShowPublishModal(true)
    }

    const handleConfirmPublish = async () => {
        setShowPublishModal(false)
        setIsPublishing(true)
        try {
            const { publishSurvey } = await import('@/services/survey.service')
            const result = await publishSurvey(surveyId)
            setSurvey({ ...survey, status: 'active' })
            if (result?.reward_warning) {
                setPublishSuccessWarning(result.reward_warning)
            }
        } catch (err: any) {
            alert(err.message || 'Gagal mem-publish survey')
        } finally {
            setIsPublishing(false)
        }
    }

    const publishBlockedByReward = Boolean(rewardEval && !rewardEval.hardOk)

    const handleStatusChange = async (newStatus: 'paused' | 'active' | 'completed') => {
        if (newStatus === 'completed') {
            setShowCloseModal(true);
            return;
        }

        let confirmMsg = '';
        if (newStatus === 'paused') confirmMsg = 'Apakah Anda yakin ingin menjeda (pause) survey ini? Responden tidak akan bisa melihat survey ini sementara waktu.';
        if (newStatus === 'active') confirmMsg = 'Apakah Anda yakin ingin mengaktifkan kembali survey ini?';

        if (!confirm(confirmMsg)) return;

        setIsChangingStatus(true);
        try {
            const { updateSurveyStatus } = await import('@/services/survey.service');
            await updateSurveyStatus(surveyId, newStatus);
            setSurvey({ ...survey, status: newStatus });
        } catch (err: any) {
            alert(err.message || 'Gagal mengubah status survey');
        } finally {
            setIsChangingStatus(false);
        }
    }

    const handleConfirmClose = async () => {
        setShowCloseModal(false);
        setIsChangingStatus(true);
        try {
            const { updateSurveyStatus } = await import('@/services/survey.service');
            await updateSurveyStatus(surveyId, 'completed');
            setSurvey({ ...survey, status: 'completed' });
        } catch (err: any) {
            alert(err.message || 'Gagal menutup survey');
        } finally {
            setIsChangingStatus(false);
        }
    }

    const handleSaveInfo = async () => {
        if (!editTitle.trim()) {
            alert('Judul tidak boleh kosong');
            return;
        }

        setIsSavingInfo(true);
        try {
            const { updateSurveyDetails } = await import('@/services/survey.service');
            await updateSurveyDetails(surveyId, { title: editTitle, description: editDescription });
            setSurvey({ ...survey, title: editTitle, description: editDescription });
            setIsEditingInfo(false);
        } catch (err: any) {
            alert(err.message || 'Gagal menyimpan perubahan');
        } finally {
            setIsSavingInfo(false);
        }
    }

    const handleSaveReward = async () => {
        const rewardValue = Number(editReward);
        if (isNaN(rewardValue) || rewardValue <= 0) {
            alert('Reward harus berupa angka lebih dari 0');
            return;
        }

        setIsSavingReward(true);
        try {
            const { updateSurveyDetails } = await import('@/services/survey.service');
            await updateSurveyDetails(surveyId, { reward_per_response: rewardValue });
            setSurvey({ ...survey, reward_per_response: rewardValue });
            setIsEditingReward(false);
        } catch (err: any) {
            alert(err.message || 'Gagal menyimpan reward');
        } finally {
            setIsSavingReward(false);
        }
    }

    const handleDeleteSurvey = async () => {
        if (!confirm('Apakah Anda yakin ingin MENGHAPUS survey ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return;

        setIsDeleting(true);
        try {
            const { deleteSurvey } = await import('@/services/survey.service');
            await deleteSurvey(surveyId);
            router.push('/my-surveys');
            router.refresh();
        } catch (err: any) {
            alert(err.message || 'Gagal menghapus survey');
            setIsDeleting(false);
        }
    }

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                .survey-detail-root { font-family: 'Inter', sans-serif; }
                .card-hover { transition: box-shadow 0.2s, transform 0.2s; }
                .card-hover:hover { box-shadow: 0 4px 24px 0 rgba(0,0,0,0.08); transform: translateY(-1px); }
                .progress-bar-fill { transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
                .chip-btn { transition: all 0.15s ease; }
                .chip-btn:hover { transform: scale(1.03); }
                .pulse-dot { animation: pulse-dot 2s infinite; }
                @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>

            <section className="survey-detail-root mx-auto w-full max-w-6xl">

                    {/* Back */}
                    <Link
                        href="/my-surveys"
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 mb-6"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Kembali ke My Surveys
                    </Link>

                    {/* Loading */}
                    {loading && (
                        <div className="flex h-64 items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
                                <p className="text-sm text-slate-400 font-medium">Memuat detail survey...</p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
                            <span className="text-xl shrink-0">⚠️</span>
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Content */}
                    {!loading && survey && (
                        <div className="space-y-5">

                            {/* ===== HERO HEADER CARD ===== */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                {/* Accent stripe */}
                                <div className="h-1.5 w-full" style={{ background: survey.status === 'active' ? 'linear-gradient(90deg, #10b981, #059669)' : survey.status === 'paused' ? 'linear-gradient(90deg, #f59e0b, #d97706)' : survey.status === 'completed' ? 'linear-gradient(90deg, #3b82f6, #2563eb)' : 'linear-gradient(90deg, #94a3b8, #64748b)' }} />
                                
                                <div className="p-6">
                                    {/* Top row: status + actions */}
                                    <div className="flex items-center justify-between mb-4">
                                        <StatusBadge status={survey.status} />
                                        <div className="flex items-center gap-2">
                                            {survey.status === 'draft' && !isEditingInfo && (
                                                <>
                                                    <button
                                                        onClick={handlePublish}
                                                        disabled={isPublishing || questions.length === 0 || publishBlockedByReward}
                                                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-sm ${
                                                            isPublishing || questions.length === 0 || publishBlockedByReward
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                                                : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md'
                                                        }`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                                                        </svg>
                                                        {isPublishing ? 'Publishing...' : 'Publish'}
                                                    </button>
                                                    <button
                                                        onClick={handleDeleteSurvey}
                                                        disabled={isDeleting}
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-500 transition-all hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        {isDeleting ? 'Menghapus...' : 'Hapus'}
                                                    </button>
                                                </>
                                            )}
                                            {survey.status === 'active' && !isEditingInfo && (
                                                <button
                                                    onClick={() => handleStatusChange('paused')}
                                                    disabled={isChangingStatus}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-all disabled:opacity-50"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                                    </svg>
                                                    {isChangingStatus ? 'Processing...' : 'Pause'}
                                                </button>
                                            )}
                                            {survey.status === 'paused' && !isEditingInfo && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleStatusChange('active')}
                                                        disabled={isChangingStatus}
                                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 shadow-sm transition-all disabled:opacity-50"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
                                                        {isChangingStatus ? 'Processing...' : 'Resume'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange('completed')}
                                                        disabled={isChangingStatus}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-100 transition-all disabled:opacity-50"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                                        </svg>
                                                        {isChangingStatus ? 'Processing...' : 'Tutup'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Title & description */}
                                    {isEditingInfo ? (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="w-full text-2xl font-bold text-slate-900 border-2 border-blue-400 focus:outline-none focus:border-blue-500 bg-blue-50/40 px-3 py-2 rounded-xl"
                                                placeholder="Judul Survey"
                                            />
                                            <textarea
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                className="w-full text-slate-600 border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-sm resize-none"
                                                placeholder="Deskripsi Survey (Opsional)"
                                                rows={3}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveInfo}
                                                    disabled={isSavingInfo}
                                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
                                                >
                                                    {isSavingInfo ? 'Menyimpan...' : 'Simpan Perubahan'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsEditingInfo(false);
                                                        setEditTitle(survey.title || '');
                                                        setEditDescription(survey.description || '');
                                                    }}
                                                    disabled={isSavingInfo}
                                                    className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all"
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1">
                                                    <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                                                        {survey.title}
                                                    </h1>
                                                    {survey.description && (
                                                        <p className="mt-2 text-slate-500 text-sm leading-relaxed">
                                                            {survey.description}
                                                        </p>
                                                    )}
                                                </div>
                                                {survey.status === 'draft' && (
                                                    <button
                                                        onClick={() => setIsEditingInfo(true)}
                                                        className="opacity-0 group-hover:opacity-100 shrink-0 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Edit Judul & Deskripsi"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Quick stats row */}
                                            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
                                                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="font-semibold text-slate-700">{survey.total_responses}</span> target responden
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className="font-semibold text-slate-700">{questions.length}</span> pertanyaan
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className="font-semibold text-blue-600">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(survey.reward_per_response)}
                                                    </span> / responden
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reward warning banner setelah publish */}
                            {survey.status === 'active' && publishSuccessWarning && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex gap-3 items-start">
                                    <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                                    <div className="flex-1">
                                        <p className="font-semibold text-amber-900 text-sm">Insight Reward</p>
                                        <p className="mt-0.5 text-sm text-amber-800">{publishSuccessWarning}</p>
                                    </div>
                                    <button
                                        onClick={() => setPublishSuccessWarning(null)}
                                        className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* ===== METRICS GRID: Reward + Progress ===== */}
                            {(() => {
                                const total = survey.total_responses;
                                const completed = burnRate?.completed_responses ?? Math.max(0, total - survey.remaining_responses);
                                const remaining = burnRate?.remaining_responses ?? Math.max(0, total - completed);
                                const progressPercent = total > 0 ? (completed / total) * 100 : 0;

                                const budgetTerpakai = burnRate?.total_spent ?? completed * survey.reward_per_response;
                                const sisaBudget = burnRate?.remaining_budget ?? remaining * survey.reward_per_response;
                                const totalBudget = budgetTerpakai + sisaBudget;
                                const budgetTerpakaiPercent = totalBudget > 0 ? (budgetTerpakai / totalBudget) * 100 : 0;

                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {/* Reward Card */}
                                        <div id="reward-section" className="card-hover rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Reward</p>
                                                </div>
                                                {survey.status === 'draft' && !isEditingReward && (
                                                    <button
                                                        onClick={() => { setEditReward(survey.reward_per_response); setIsEditingReward(true); }}
                                                        className="text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit
                                                    </button>
                                                )}
                                            </div>

                                            {isEditingReward ? (
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rp</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={editReward}
                                                            onChange={(e) => setEditReward(e.target.value === '' ? '' : Number(e.target.value))}
                                                            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={handleSaveReward} disabled={isSavingReward || editReward === '' || editReward <= 0}
                                                            className="flex-1 rounded-xl bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400">
                                                            {isSavingReward ? 'Simpan...' : 'Simpan'}
                                                        </button>
                                                        <button onClick={() => setIsEditingReward(false)} disabled={isSavingReward}
                                                            className="flex-1 rounded-xl border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                                                            Batal
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-2xl font-extrabold text-blue-600">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(survey.reward_per_response)}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-1">per responden</p>
                                                </>
                                            )}

                                            {/* Reward eval warning */}
                                            {rewardEval && !rewardEval.hardOk && (
                                                <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 p-2">
                                                    <span className="text-xs shrink-0">❌</span>
                                                    <p className="text-xs text-red-600">{rewardEval.hardMessage}</p>
                                                </div>
                                            )}
                                            {rewardEval && rewardEval.hardOk && !rewardEval.softOk && (
                                                <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2">
                                                    <span className="text-xs shrink-0">⚠️</span>
                                                    <p className="text-xs text-amber-700">{rewardEval.softWarning}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Progress Card */}
                                        <div className="card-hover rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </div>
                                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Progress</p>
                                            </div>
                                            <div className="flex items-baseline gap-1 mb-3">
                                                <span className="text-2xl font-extrabold text-slate-900">{completed}</span>
                                                <span className="text-sm text-slate-400 font-medium">/ {total}</span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                    className="progress-bar-fill h-full rounded-full"
                                                    style={{
                                                        width: `${Math.round(progressPercent)}%`,
                                                        background: 'linear-gradient(90deg, #10b981, #059669)'
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2">{Math.round(progressPercent)}% selesai</p>
                                        </div>

                                        {/* Budget Card */}
                                        <div className="card-hover rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Budget</p>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-400">{Math.round(budgetTerpakaiPercent)}% terpakai</span>
                                            </div>
                                            <p className="text-2xl font-extrabold text-slate-900 mb-3">
                                                Rp{sisaBudget.toLocaleString('id-ID')}
                                            </p>
                                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                    className="progress-bar-fill h-full rounded-full"
                                                    style={{
                                                        width: `${budgetTerpakaiPercent}%`,
                                                        background: 'linear-gradient(90deg, #f97316, #ea580c)'
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2">sisa dari {remaining} responden</p>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* ===== TARGET RESPONDEN CARD ===== */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Target Responden</p>
                                            <p className="text-xs text-slate-400">Filter audiens yang sesuai</p>
                                        </div>
                                    </div>
                                    {survey.status === 'draft' && !isEditingTargeting && (
                                        <button
                                            onClick={handleStartEditTargeting}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit Targeting
                                        </button>
                                    )}
                                </div>

                                {isEditingTargeting ? (
                                    <div className="p-5 space-y-5">
                                        {/* Gender */}
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Gender</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {[
                                                    { value: null, label: 'Semua', icon: '👥' },
                                                    { value: 'male', label: 'Pria', icon: '👨' },
                                                    { value: 'female', label: 'Wanita', icon: '👩' },
                                                ].map((opt) => (
                                                    <button
                                                        key={String(opt.value)}
                                                        type="button"
                                                        onClick={() => setEditTargetGender(opt.value)}
                                                        className={`chip-btn flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
                                                            editTargetGender === opt.value
                                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <span>{opt.icon}</span>{opt.label}
                                                        {editTargetGender === opt.value && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Rentang Usia */}
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Rentang Usia</p>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="1" max="100"
                                                        placeholder="Min"
                                                        value={editTargetAgeMin}
                                                        onChange={(e) => setEditTargetAgeMin(e.target.value === '' ? '' : Number(e.target.value))}
                                                        className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                                    />
                                                </div>
                                                <div className="h-px w-4 bg-slate-300" />
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="1" max="100"
                                                        placeholder="Max"
                                                        value={editTargetAgeMax}
                                                        onChange={(e) => setEditTargetAgeMax(e.target.value === '' ? '' : Number(e.target.value))}
                                                        className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">tahun</span>
                                            </div>
                                        </div>

                                        {/* Pekerjaan */}
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                                Pekerjaan
                                                {editTargetJobs.length > 0 && (
                                                    <span className="ml-2 normal-case font-normal text-indigo-500">({editTargetJobs.length} dipilih)</span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {JOB_OPTIONS.map((job) => {
                                                    const isSelected = editTargetJobs.includes(job)
                                                    return (
                                                        <button
                                                            key={job}
                                                            type="button"
                                                            onClick={() => setEditTargetJobs(prev =>
                                                                isSelected ? prev.filter(j => j !== job) : [...prev, job]
                                                            )}
                                                            className={`chip-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                                                isSelected
                                                                    ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                                            }`}
                                                        >
                                                            {isSelected && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                            {job}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-1 border-t border-slate-100">
                                            <button
                                                onClick={handleSaveTargeting}
                                                disabled={isSavingTargeting}
                                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300 transition-all shadow-sm"
                                            >
                                                {isSavingTargeting ? 'Menyimpan...' : 'Simpan Targeting'}
                                            </button>
                                            <button
                                                onClick={handleCancelTargeting}
                                                disabled={isSavingTargeting}
                                                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-all"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-5">
                                        {!targeting || (!targeting.gender && !targeting.age_min && !targeting.age_max && !(targeting.jobs?.length)) ? (
                                            <div className="flex items-center gap-3 py-2">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-sm">🌐</span>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">Terbuka untuk Semua</p>
                                                    <p className="text-xs text-slate-400">Semua responden dapat mengisi survey ini</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-4">
                                                {targeting.gender && (
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gender</span>
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                                                            {targeting.gender === 'male' ? '👨 Pria' : '👩 Wanita'}
                                                        </span>
                                                    </div>
                                                )}
                                                {(targeting.age_min || targeting.age_max) && (
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usia</span>
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                                                            🎂 {targeting.age_min ?? '?'} – {targeting.age_max ?? '?'} thn
                                                        </span>
                                                    </div>
                                                )}
                                                {targeting.jobs && targeting.jobs.length > 0 && (
                                                    <div className="flex items-start gap-2.5 w-full">
                                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1 shrink-0">Pekerjaan</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {targeting.jobs.map(job => (
                                                                <span key={job} className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200">
                                                                    {job}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {survey.status !== 'draft' && (
                                            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                Targeting tidak dapat diubah setelah survey dipublish.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ===== ESTIMASI WAKTU + INSIGHT ===== */}
                            {(() => {
                                const total = survey.total_responses;
                                const completed = burnRate?.completed_responses ?? Math.max(0, total - survey.remaining_responses);
                                const remaining = burnRate?.remaining_responses ?? Math.max(0, total - completed);

                                const responsesPerMinute = burnRate?.responses_per_minute ?? 0;
                                const estimatedMinutesToFinish = burnRate?.estimated_minutes_to_finish ?? null;
                                const hoursToFinish = estimatedMinutesToFinish !== null ? estimatedMinutesToFinish / 60 : null;
                                const isDataEnough = burnRate?.has_enough_data ?? (completed >= 5 && responsesPerMinute > 0);

                                return (
                                    <>
                                        {/* Estimasi Waktu */}
                                        <div className="card-hover rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Estimasi Waktu Selesai</p>
                                                    <p className="text-xs text-slate-400">Berdasarkan kecepatan respon saat ini</p>
                                                </div>
                                            </div>
                                            <div className="p-5">
                                                {!isDataEnough ? (
                                                    <div className="flex items-center gap-3 text-slate-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <p className="text-sm">Belum ada cukup data. Minimal 5 respons diperlukan untuk estimasi.</p>
                                                    </div>
                                                ) : (() => {
                                                    const safeHoursToFinish = hoursToFinish ?? 0;
                                                    const formatDynamicTime = (hours: number) => {
                                                        if (hours >= 24) {
                                                            const d = Math.floor(hours / 24);
                                                            const remainingHours = Math.floor(hours % 24);
                                                            const remainingMinutes = Math.round((hours % 1) * 60);
                                                            if (remainingHours > 0) return `${d} Hari ${remainingHours} Jam`;
                                                            else if (remainingMinutes > 0) return `${d} Hari ${remainingMinutes} Menit`;
                                                            else return `${d} Hari`;
                                                        } else {
                                                            const h = Math.floor(hours);
                                                            const m = Math.round((hours % 1) * 60);
                                                            if (h > 0) { if (m > 0) return `${h} Jam ${m} Menit`; return `${h} Jam`; }
                                                            return `${m} Menit`;
                                                        }
                                                    };
                                                    const timeText = formatDynamicTime(safeHoursToFinish);
                                                    const speedType = safeHoursToFinish < 2 ? 'fast' : safeHoursToFinish <= 6 ? 'normal' : 'slow';
                                                    const speedConfig = {
                                                        fast:   { label: 'Cepat', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: '⚡' },
                                                        normal: { label: 'Normal', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', icon: '🕐' },
                                                        slow:   { label: 'Lambat', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-400', icon: '⚠️' },
                                                    }[speedType];

                                                    return (
                                                        <div className="flex items-center gap-5 flex-wrap">
                                                            <div>
                                                                <p className="text-3xl font-extrabold text-slate-900">{timeText}</p>
                                                                <p className="text-xs text-slate-400 mt-1">estimasi sisa waktu</p>
                                                            </div>
                                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${speedConfig.bg} ${speedConfig.border} ${speedConfig.color}`}>
                                                                <span className={`h-2 w-2 rounded-full ${speedConfig.dot}`} />
                                                                {speedConfig.icon} {speedConfig.label}
                                                            </div>
                                                            {isDataEnough && (
                                                                <p className="text-xs text-slate-400">~{responsesPerMinute.toFixed(2)} respon/mnt</p>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Evaluasi & Insight */}
                                        {(() => {
                                            const insight = generateSurveyInsight({
                                                status: survey.status,
                                                reward: survey.reward_per_response,
                                                recommended_reward: rewardEval?.recommended || 0,
                                                responses: completed,
                                                valid_rate: insightData?.rates?.valid,
                                                low_quality_rate: insightData?.rates?.lowQuality,
                                                isDataEnough,
                                                hoursToFinish: hoursToFinish ?? undefined
                                            });

                                            const estimation = survey.status === 'draft' && rewardEval ? getEstimationSummary(
                                                survey.reward_per_response,
                                                rewardEval.recommended,
                                                survey.total_responses
                                            ) : null;

                                            if (!insight && !estimation) return null;

                                            const insightBg = insight?.type === 'good' ? '#f0fdf4' : insight?.type === 'normal' ? '#fffbeb' : insight?.type === 'warning' ? '#fff7ed' : insight?.type === 'danger' ? '#fef2f2' : '#eff6ff';
                                            const insightBorder = insight?.type === 'good' ? '#bbf7d0' : insight?.type === 'normal' ? '#fde68a' : insight?.type === 'warning' ? '#fed7aa' : insight?.type === 'danger' ? '#fecaca' : '#bfdbfe';
                                            const insightTitleColor = insight?.type === 'good' ? '#14532d' : insight?.type === 'normal' ? '#78350f' : insight?.type === 'warning' ? '#7c2d12' : insight?.type === 'danger' ? '#7f1d1d' : '#1e3a5f';
                                            const insightTextColor = insight?.type === 'good' ? '#166534' : insight?.type === 'normal' ? '#92400e' : insight?.type === 'warning' ? '#9a3412' : insight?.type === 'danger' ? '#991b1b' : '#1e40af';
                                            const insightIcon = insight?.type === 'good' ? '🟢' : insight?.type === 'normal' ? '🟡' : insight?.type === 'danger' ? '🔴' : insight?.type === 'warning' ? '⚠️' : '💡';

                                            return (
                                                <div className="card-hover rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">Evaluasi & Insight</p>
                                                            <p className="text-xs text-slate-400">Rekomendasi berdasarkan data survey</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-5 space-y-4">
                                                        {/* Confidence Score (draft) */}
                                                        {survey.status === 'draft' && estimation && (
                                                            <div className="rounded-xl border p-4" style={{ background: insightBg, borderColor: insightBorder }}>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: insightTitleColor }}>Confidence Score</p>
                                                                    <span className="text-2xl font-extrabold" style={{ color: insightTitleColor }}>{estimation.confidence_score}%</span>
                                                                </div>
                                                                <div className="space-y-1.5 text-sm" style={{ color: insightTextColor }}>
                                                                    <p className="font-medium flex items-center gap-1.5">
                                                                        {estimation.confidence_color === 'green' ? '🟢' : estimation.confidence_color === 'yellow' ? '🟡' : '🔴'} Kemungkinan:
                                                                    </p>
                                                                    <ul className="list-disc pl-5 space-y-1 text-xs">
                                                                        <li>Selesai {estimation.speed === 'cepat' ? 'sangat cepat' : estimation.speed === 'sedang' ? 'dalam waktu wajar' : 'sangat lambat'}</li>
                                                                        <li>Kualitas response {estimation.quality}</li>
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Main insight */}
                                                        {insight && (
                                                            <div className="rounded-xl border p-4" style={{ background: insightBg, borderColor: insightBorder }}>
                                                                {survey.status === 'draft' && rewardEval && !rewardEval.softOk && (
                                                                    <p className="text-xs font-semibold mb-2" style={{ color: insightTextColor }}>Karena reward &lt; rekomendasi final:</p>
                                                                )}
                                                                <p className="font-bold text-base mb-1" style={{ color: insightTitleColor }}>
                                                                    {insightIcon} {insight.title}
                                                                </p>
                                                                <p className="text-sm" style={{ color: insightTextColor }}>{insight.message}</p>
                                                                {insight.suggestion && (
                                                                    <p className="text-sm mt-1 font-medium" style={{ color: insightTextColor }}>→ {insight.suggestion}</p>
                                                                )}
                                                                {insight.impact && (
                                                                    <div className="mt-3 pt-2 border-t" style={{ borderColor: insightBorder }}>
                                                                        <p className="text-xs font-semibold mb-0.5" style={{ color: insightTitleColor }}>Dampak:</p>
                                                                        <p className="text-xs" style={{ color: insightTextColor }}>{insight.impact}</p>
                                                                    </div>
                                                                )}
                                                                {survey.status === 'draft' && insight.type === 'warning' && (
                                                                    <div className="mt-3">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditReward(rewardEval?.recommended || 0);
                                                                                setIsEditingReward(true);
                                                                                window.scrollTo({ top: document.getElementById('reward-section')?.offsetTop, behavior: 'smooth' });
                                                                            }}
                                                                            className="w-full text-center px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                                                            style={{ background: insightBorder, color: insightTitleColor }}
                                                                        >
                                                                            ✨ Gunakan rekomendasi final Rp {(rewardEval?.recommended || 0).toLocaleString('id-ID')}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Completed stats */}
                                                        {survey.status === 'completed' && insightData && (
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {[
                                                                    { label: 'Valid Rate', value: `${Math.round(insightData.rates.valid * 100)}%`, good: insightData.rates.valid >= 0.7 },
                                                                    { label: 'Low Quality', value: `${Math.round(insightData.rates.lowQuality * 100)}%`, good: insightData.rates.lowQuality <= 0.3 },
                                                                    { label: 'Rejected', value: `${Math.round(insightData.rates.rejected * 100)}%`, good: insightData.rates.rejected <= 0.15 },
                                                                ].map(stat => (
                                                                    <div key={stat.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</p>
                                                                        <p className={`text-lg font-extrabold ${stat.good ? 'text-emerald-600' : 'text-red-500'}`}>{stat.value}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {survey.status === 'completed' && insightData?.suggestion && (
                                                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                                                <p className="text-xs font-bold text-blue-900 mb-1.5">📝 Evaluasi AI:</p>
                                                                <p className="text-xs text-blue-800 leading-relaxed">{insightData.suggestion}</p>
                                                            </div>
                                                        )}

                                                        {survey.status === 'active' && completed < 5 && !isDataEnough && (
                                                            <p className="text-sm text-slate-400 italic">Belum ada insight. Minimal 5 response diperlukan agar pola awal bisa dibaca.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )
                            })()}

                            {/* View responses CTA */}
                            {(survey.status === 'paused' || survey.status === 'completed') && (
                                <Link
                                    href={`/my-surveys/${surveyId}/responses`}
                                    className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl shrink-0">📊</div>
                                        <div>
                                            <p className="font-bold text-blue-900 text-sm">Lihat Data Responses</p>
                                            <p className="text-xs text-blue-600 mt-0.5">
                                                {survey.total_responses - survey.remaining_responses} dari {survey.total_responses} responden telah mengisi
                                            </p>
                                        </div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            )}

                            {/* ===== QUESTIONS SECTION ===== */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Pertanyaan Survey</p>
                                            <p className="text-xs text-slate-400">{questions.length} pertanyaan ditambahkan</p>
                                        </div>
                                    </div>
                                    {survey.status === 'draft' && (
                                        <Link
                                            href={`/my-surveys/${surveyId}/add-question`}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                            </svg>
                                            Tambah Pertanyaan
                                        </Link>
                                    )}
                                </div>

                                <div className="p-5">
                                    {questions.length === 0 ? (
                                        <div className="flex flex-col items-center py-10 text-center">
                                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">📝</div>
                                            <p className="text-sm font-semibold text-slate-700">Belum ada pertanyaan</p>
                                            <p className="mt-1 text-xs text-slate-400">Tambahkan pertanyaan untuk mulai membangun surveymu.</p>
                                            {survey.status === 'draft' && (
                                                <Link
                                                    href={`/my-surveys/${surveyId}/add-question`}
                                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    Tambah Pertanyaan Pertama
                                                </Link>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {questions.map((q: Question, i: number) => (
                                                <QuestionItem
                                                    key={q.id}
                                                    question={q}
                                                    index={i}
                                                    onDelete={survey.status === 'draft' ? handleDeleteQuestion : undefined}
                                                    onEdit={survey.status === 'draft' ? handleEditQuestion : undefined}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
            </section>




            {/* ===== CLOSE SURVEY CONFIRMATION MODAL ===== */}
            {showCloseModal && survey && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowCloseModal(false)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">🛑</div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Tutup Survey Permanen</h2>
                                <p className="text-xs text-slate-400">Tindakan ini tidak bisa dibatalkan</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-5 border border-slate-100">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Judul Survey</span>
                                <span className="font-semibold text-slate-800 text-right max-w-[55%] truncate">{survey.title}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Responden Masuk</span>
                                <span className="font-semibold text-slate-800">{survey.total_responses - survey.remaining_responses} dari {survey.total_responses}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Slot Tersisa</span>
                                <span className="font-semibold text-slate-800">{survey.remaining_responses}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                                <span className="text-sm font-semibold text-slate-700">Estimasi Refund</span>
                                <span className="text-lg font-bold text-emerald-700">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(survey.remaining_responses * survey.reward_per_response)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex gap-2">
                            <span className="text-red-500 text-base shrink-0 mt-0.5">⚠️</span>
                            <p className="text-xs text-red-700 leading-relaxed">
                                Setelah ditutup, survey <strong>tidak bisa diaktifkan kembali</strong>. Sisa budget yang terkunci akan otomatis dikembalikan ke saldo kamu.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCloseModal(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConfirmClose}
                                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
                            >
                                🛑 Ya, Tutup Permanen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== PUBLISH CONFIRMATION MODAL ===== */}
            {showPublishModal && survey && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowPublishModal(false)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">🚀</div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Konfirmasi Publish Survey</h2>
                                <p className="text-xs text-slate-400">Tinjau detail sebelum melanjutkan</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 mb-5">
                            {[
                                { label: 'Judul Survey', value: survey.title, truncate: true },
                                { label: 'Jumlah Pertanyaan', value: `${questions.length} pertanyaan`, warn: questions.length === 0 },
                                { label: 'Target Responden', value: `${survey.total_responses} orang` },
                                { label: 'Reward / Responden', value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(survey.reward_per_response), highlight: 'blue' },
                                { label: 'Total Budget', value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(survey.reward_per_response * survey.total_responses), highlight: 'green' },
                            ].map((item, i, arr) => (
                                <div key={item.label} className={`flex justify-between items-center text-sm ${i < arr.length - 1 ? 'pb-3 border-b border-slate-200' : ''}`}>
                                    <span className="text-slate-500">{item.label}</span>
                                    <span className={`font-semibold text-right max-w-[55%] ${item.truncate ? 'truncate' : ''} ${item.warn && questions.length === 0 ? 'text-red-500' : item.highlight === 'blue' ? 'text-blue-600' : item.highlight === 'green' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                        {item.value} {item.warn && questions.length === 0 && '⚠️'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {rewardEval && !rewardEval.hardOk && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                                <p className="font-bold text-red-600 mb-3 flex items-center gap-2 text-sm">
                                    <span>❌</span> Reward terlalu rendah
                                </p>
                                <div className="mb-4 space-y-1 text-sm text-red-800">
                                    <p>Minimal: <span className="font-semibold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(rewardEval.minRequired)}</span></p>
                                    <p>Rekomendasi: <span className="font-semibold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(rewardEval.recommended)}</span></p>
                                </div>
                                <button
                                    onClick={() => { setShowPublishModal(false); setEditReward(rewardEval.recommended); setIsEditingReward(true); window.scrollTo({ top: document.getElementById('reward-section')?.offsetTop, behavior: 'smooth' }); }}
                                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl transition-colors border border-red-300 w-full text-sm"
                                >
                                    ✨ Gunakan Rekomendasi Final
                                </button>
                            </div>
                        )}

                        {rewardEval && rewardEval.hardOk && !rewardEval.softOk && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                                <p className="font-bold text-amber-600 mb-3 flex items-center gap-2 text-sm">
                                    <span>⚠️</span> Reward di bawah rekomendasi
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800 mb-3">
                                    <li>Survey kemungkinan berjalan lambat</li>
                                    <li>Risiko mendapat banyak respon low quality</li>
                                </ul>
                                <button
                                    onClick={() => { setShowPublishModal(false); setEditReward(rewardEval.recommended); setIsEditingReward(true); window.scrollTo({ top: document.getElementById('reward-section')?.offsetTop, behavior: 'smooth' }); }}
                                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-xl transition-colors border border-amber-300 w-full text-sm text-center"
                                >
                                    ✨ Gunakan Rekomendasi Rp {rewardEval.recommended.toLocaleString('id-ID')}
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowPublishModal(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            {(!rewardEval || (rewardEval.hardOk && rewardEval.softOk)) && (
                                <button
                                    onClick={handleConfirmPublish}
                                    disabled={questions.length === 0}
                                    className={`flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all ${questions.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow-md'}`}
                                >
                                    ✅ Ya, Publish Sekarang
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
