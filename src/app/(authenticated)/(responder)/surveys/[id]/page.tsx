"use client";

import { useEffect, useState, use, useRef } from "react";
import { getSurveyById, getSurveyQuestions } from "@/services/survey.service";
import { getResponseById, startSurveyResponse, getDraftResponse, saveAnswer } from "@/services/response.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SubmitResponseButton, { type SubmitResponseResult } from "@/components/responder/SubmitResponseButton";
import SubmissionFeedback from "@/components/responder/SubmissionFeedback";


export default function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const [responseId, setResponseId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'restored'>('idle');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitResponseResult | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [surveyResult, questionsResult, sessionResult] = await Promise.all([
          getSurveyById(id),
          getSurveyQuestions(id),
          supabase.auth.getSession()
        ]);

        const surveyData = surveyResult?.data ?? null;
        const questionsData = questionsResult?.data ?? [];
        const session = sessionResult?.data?.session;
        const currentUser = session?.user;

        if (surveyData && currentUser && currentUser.id === surveyData.creator_id) {
          router.replace(`/my-surveys/${id}`);
          return;
        }

        if (surveyData) setSurvey(surveyData);
        if (questionsData) setQuestions(questionsData);

        if (surveyData?.draft_response_id) {
          setResponseId(surveyData.draft_response_id);

          const draft = await getDraftResponse(id);
          if (draft.length > 0) {
            const restored: Record<string, string | string[]> = {};
            for (const row of draft) {
              if (row.option_id) {
                const q = questionsData.find((q: any) => q.id === row.question_id);
                if (q?.question_type === 'checkbox') {
                  const existing = (restored[row.question_id] as string[]) || [];
                  restored[row.question_id] = [...existing, row.option_id];
                } else {
                  restored[row.question_id] = row.option_id;
                }
              } else if (row.answer_text) {
                restored[row.question_id] = row.answer_text;
              }
            }
            setAnswers(restored);
            setSaveStatus('restored');
          }
        }
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // ─── Start survey ────────────────────────────────────────────────────────────
  const handleStartSurvey = async () => {
    setIsStarting(true);
    try {
      const rid = await startSurveyResponse(id);
      setResponseId(rid);

      const draft = await getDraftResponse(id);
      if (draft.length > 0) {
        const restored: Record<string, string | string[]> = {};
        for (const row of draft) {
          if (row.option_id) {
            const q = questions.find(q => q.id === row.question_id);
            if (q?.question_type === 'checkbox') {
              const existing = (restored[row.question_id] as string[]) || [];
              restored[row.question_id] = [...existing, row.option_id];
            } else {
              restored[row.question_id] = row.option_id;
            }
          } else if (row.answer_text) {
            restored[row.question_id] = row.answer_text;
          }
        }
        setAnswers(restored);
        setSaveStatus('restored');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  // ─── Save answer ─────────────────────────────────────────────────────────────
  const handleAnswerChange = (
    questionId: string,
    questionType: string,
    value: string | string[]
  ) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    if (!responseId) return;

    setSaveStatus('saving');

    if (saveTimeoutRef.current[questionId]) {
      clearTimeout(saveTimeoutRef.current[questionId]);
    }

    const delay = questionType === 'text' ? 800 : 0;

    saveTimeoutRef.current[questionId] = setTimeout(async () => {
      try {
        if (questionType === 'checkbox') {
          await saveAnswer({
            response_id: responseId,
            question_id: questionId,
            option_ids: value as string[],
          });
        } else if (questionType === 'radio') {
          await saveAnswer({
            response_id: responseId,
            question_id: questionId,
            option_id: value as string,
          });
        } else {
          await saveAnswer({
            response_id: responseId,
            question_id: questionId,
            answer_text: value as string,
          });
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save answer:', err);
        setSaveStatus('error');
      }
    }, delay);
  };

  const isFormValid = () => {
    if (questions.length === 0) return true;
    return questions.every(q => {
      const answer = answers[q.id];
      if (q.question_type === 'text') return typeof answer === 'string' && answer.trim().length > 0;
      if (q.question_type === 'radio') return typeof answer === 'string' && answer.length > 0;
      if (q.question_type === 'checkbox') return Array.isArray(answer) && answer.length > 0;
      return false;
    });
  };

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-6xl animate-pulse">
        <div className="mb-6 h-5 w-40 rounded bg-gray-200" />
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
          <div className="h-1.5 bg-gradient-to-r from-gray-200 to-gray-100" />
          <div className="p-8 space-y-4">
            <div className="flex justify-between">
              <div className="h-6 w-20 rounded-full bg-emerald-100" />
              <div className="h-6 w-24 rounded-full bg-gray-100" />
            </div>
            <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-5/6 rounded bg-gray-100" />
            <div className="grid grid-cols-2 gap-4 pt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 border border-gray-200" />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-gray-200 to-gray-100" />
          <div className="p-8 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-5 border border-gray-100 rounded-xl bg-gray-50 space-y-3">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
                <div className="h-3 w-2/3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ── Error / Not Found ──────────────────────────────────────────────────────
  if (error || !survey) {
    const isTargetingError = error ? error.includes("Anda tidak memenuhi kriteria target responden survei ini") : false;

    return (
      <section className="mx-auto w-full max-w-6xl">
        <Link
          href="/responder/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-emerald-600 transition-colors mb-8 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Kembali ke Jelajah Survei
        </Link>

        {isTargetingError ? (
          <div className="rounded-2xl border border-amber-100 bg-white shadow-xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-yellow-400" />
            <div className="p-8 md:p-10 text-center">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-100 text-amber-500">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Profil Anda Belum Sesuai Kriteria</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed text-sm">
                Pembuat survei ini membatasi responden berdasarkan kriteria profil tertentu (seperti usia, gender, atau jenis pekerjaan) yang saat ini belum sesuai dengan profil Anda.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/responder/profile"
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-sm text-center"
                >
                  Perbarui Profil Anda
                </Link>
                <Link
                  href="/responder/explore"
                  className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 active:scale-95 transition-all text-sm text-center"
                >
                  Cari Survei Lain
                </Link>
              </div>
            </div>
            <div className="bg-amber-50/50 border-t border-amber-100/50 px-8 py-4 text-xs text-amber-700 text-center">
              Pastikan profil Anda selalu diperbarui untuk mendapatkan akses ke lebih banyak survei.
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-100 bg-white shadow-xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-red-400 to-rose-500" />
            <div className="p-8 md:p-10 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 text-red-500">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Gagal Memuat Survei</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed text-sm">
                {error || "Survei tidak ditemukan atau terjadi kesalahan saat mengambil data."}
              </p>
              <Link
                href="/responder/explore"
                className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-md active:scale-95 transition-all text-sm text-center"
              >
                Kembali ke Jelajah Survei
              </Link>
            </div>
          </div>
        )}
      </section>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <section className="mx-auto w-full max-w-6xl">
      {/* Back link */}
      <Link
        href="/responder/explore"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-emerald-600 transition-colors mb-6 group"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span> Kembali ke Jelajah Survei
      </Link>

      {/* Survey Info Card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
        {/* Accent header strip */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-emerald-100/80 uppercase tracking-widest font-bold">Survei Aktif</p>
              <h1 className="text-base font-bold text-white leading-tight line-clamp-1">{survey.title || "Untitled Survey"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {survey.status === 'active' ? 'Active' : survey.status || 'Unknown'}
            </span>
            <span className="text-xs text-emerald-100/80 font-medium bg-white/10 px-2.5 py-1 rounded-full">
              {survey.remaining_responses} tersisa
            </span>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* Description */}
          {survey.description && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Deskripsi</h3>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">{survey.description}</p>
            </div>
          )}

          {/* Quality warning */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800">
              <strong>Penting:</strong> Berikan jawaban yang jujur dan berkualitas. Respons yang buruk atau asal-asalan akan mengakibatkan pengurangan jumlah reward yang kamu terima.
            </p>
          </div>

          {/* Meta info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 pt-6">
            {survey.reward_per_response !== undefined && (
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-4 rounded-xl border border-emerald-200/50 shadow-sm">
                <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">Reward</p>
                <p className="text-lg font-extrabold text-emerald-900">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(survey.reward_per_response)}
                </p>
              </div>
            )}
            {survey.total_responses !== undefined && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 p-4 rounded-xl border border-blue-200/50 shadow-sm">
                <p className="text-blue-700 text-xs font-semibold uppercase tracking-wider mb-1">Target Respons</p>
                <p className="text-lg font-extrabold text-blue-900">{survey.total_responses}</p>
              </div>
            )}
            {survey.created_at && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/40 p-4 rounded-xl border border-gray-200/50 shadow-sm">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Dibuat</p>
                <p className="text-sm font-bold text-gray-800">
                  {new Date(survey.created_at).toLocaleDateString('id-ID', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>
              </div>
            )}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100/40 p-4 rounded-xl border border-gray-200/50 shadow-sm col-span-1">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Survey ID</p>
              <p className="text-xs font-mono text-gray-500 break-all truncate">{survey.id?.substring(0, 16)}…</p>
            </div>
          </div>
        </div>
      </div>

      {/* Start / Questions area */}
      {!responseId && !survey.has_submitted ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">Mulai Survei</h2>
              <p className="text-[10px] text-blue-100/80 mt-0.5">{questions.length} pertanyaan menunggu</p>
            </div>
          </div>

          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5 border border-blue-100">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Siap untuk memulai?</h2>
            <p className="text-gray-500 mb-8 max-w-md text-sm leading-relaxed">
              Luangkan waktu sejenak untuk membaca detail survey di atas. Setelah kamu siap, klik tombol mulai. Timer akan berjalan, dan menjawab pertanyaan secara terburu-buru dapat memengaruhi skor dan reputasi kamu!
            </p>
            <button
              onClick={handleStartSurvey}
              disabled={isStarting}
              className="px-8 py-3 font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-95 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memulai...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ya, Mulai Survey
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Questions Section */}
          {questions && questions.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
              {/* Accent header */}
              <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none">Pertanyaan</h2>
                    <p className="text-[10px] text-indigo-100/80 mt-0.5">{questions.length} pertanyaan harus dijawab</p>
                  </div>
                </div>

                {/* Save status badge */}
                {saveStatus !== 'idle' && (
                  <div className="text-xs flex items-center gap-1.5 font-semibold transition-all duration-300">
                    {saveStatus === 'saving' && (
                      <span className="text-indigo-200 flex items-center gap-1 animate-pulse bg-white/10 px-2.5 py-1 rounded-full">
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Menyimpan...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="text-white flex items-center gap-1 bg-emerald-500/30 px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Tersimpan
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-rose-200 flex items-center gap-1 bg-rose-500/20 px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Gagal simpan
                      </span>
                    )}
                    {saveStatus === 'restored' && (
                      <span className="text-white flex items-center gap-1 bg-purple-500/30 px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Draft dipulihkan
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8">
                <fieldset disabled={survey.has_submitted || isSubmitting} className="group">
                  <div className="space-y-5 group-disabled:opacity-70">
                    {questions.map((q: any, index: number) => (
                      <div key={q.id} className="p-5 border border-gray-100 rounded-xl bg-gray-50/80 hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors">
                        <p className="font-semibold text-gray-900 mb-4 text-sm">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mr-2 shrink-0">
                            {index + 1}
                          </span>
                          {q.question_text}
                        </p>

                        {q.question_type === 'text' && (
                          <input
                            type="text"
                            placeholder="Jawaban kamu..."
                            value={(answers[q.id] as string) || ''}
                            onChange={(e) => handleAnswerChange(q.id, 'text', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 bg-white placeholder:text-gray-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                          />
                        )}

                        {q.question_type === 'radio' && q.options && (
                          <div className="space-y-2.5">
                            {q.options.map((opt: any) => (
                              <label key={opt.id} className="flex items-center gap-3 cursor-pointer group/opt">
                                <input
                                  type="radio"
                                  name={`question-${q.id}`}
                                  value={opt.id}
                                  checked={answers[q.id] === opt.id}
                                  onChange={() => handleAnswerChange(q.id, 'radio', opt.id)}
                                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700 group-hover/opt:text-gray-900 transition-colors">{opt.option_text}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.question_type === 'checkbox' && q.options && (
                          <div className="space-y-2.5">
                            {q.options.map((opt: any) => (
                              <label key={opt.id} className="flex items-center gap-3 cursor-pointer group/opt">
                                <input
                                  type="checkbox"
                                  name={`question-${q.id}`}
                                  value={opt.id}
                                  checked={Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).includes(opt.id) : false}
                                  onChange={(e) => {
                                    const current = (answers[q.id] as string[]) || [];
                                    const updated = e.target.checked
                                      ? [...current, opt.id]
                                      : current.filter(v => v !== opt.id);
                                    handleAnswerChange(q.id, 'checkbox', updated);
                                  }}
                                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700 group-hover/opt:text-gray-900 transition-colors">{opt.option_text}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center">
                    {!isFormValid() && !survey.has_submitted && (
                      <p className="text-amber-700 text-sm mb-5 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl w-full max-w-sm text-center font-medium">
                        Harap jawab semua pertanyaan sebelum mengirim.
                      </p>
                    )}

                    <SubmitResponseButton
                      surveyId={survey.id}
                      hasSubmitted={survey.has_submitted}
                      disabled={!isFormValid() || saveStatus === 'saving' || saveStatus === 'error'}
                      onSubmitStart={() => setIsSubmitting(true)}
                      onSubmitError={() => setIsSubmitting(false)}
                      onSuccessCallback={async (result) => {
                        try {
                          const detailRes = await getResponseById(result.id);
                          if (detailRes?.data) {
                            setSubmissionResult(detailRes.data);
                          } else {
                            setSubmissionResult(result);
                          }
                        } catch (err) {
                          console.error("Failed to fetch response details:", err);
                          setSubmissionResult(result);
                        }

                        setIsSubmitting(false);
                        setSurvey((prev: any) => ({
                          ...prev,
                          remaining_responses: Math.max(0, prev.remaining_responses - 1),
                          has_submitted: true
                        }));

                        window.dispatchEvent(new CustomEvent('wallet-updated'));
                      }}
                    />
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {submissionResult && (
            <SubmissionFeedback
              result={submissionResult}
              surveyTitle={survey.title}
              onClose={() => setSubmissionResult(null)}
            />
          )}
        </>
      )}
    </section>
  );
}
