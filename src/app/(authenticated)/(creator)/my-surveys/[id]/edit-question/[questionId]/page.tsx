'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSurveyQuestions, updateSurveyQuestion } from '@/services/survey.service'

export default function EditQuestionPage() {
    const params = useParams()
    const router = useRouter()
    const surveyId = params.id as string
    const questionId = params.questionId as string

    const [questionText, setQuestionText] = useState('')
    const [questionType, setQuestionType] = useState('text')
    const [options, setOptions] = useState<string[]>(['', ''])
    
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const isOptionType = questionType === 'radio' || questionType === 'checkbox'

    useEffect(() => {
        const fetchQuestion = async () => {
            try {
                const qJson = await getSurveyQuestions(surveyId);
                const question = qJson.data?.find((q: any) => q.id === questionId);

                if (!question) {
                    setError('Pertanyaan tidak ditemukan');
                    return;
                }

                setQuestionText(question.question_text);
                setQuestionType(question.question_type);
                
                if (question.options && question.options.length > 0) {
                    setOptions(question.options.map((o: any) => o.option_text));
                } else if (question.question_type !== 'text') {
                    setOptions(['', '']);
                }
            } catch (err: any) {
                setError(err.message || 'Gagal memuat pertanyaan');
            } finally {
                setInitialLoading(false);
            }
        }

        fetchQuestion();
    }, [surveyId, questionId]);

    const handleAddOption = () => {
        setOptions([...options, ''])
    }

    const handleRemoveOption = (index: number) => {
        const newOptions = options.filter((_, i) => i !== index)
        setOptions(newOptions)
    }

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options]
        newOptions[index] = value
        setOptions(newOptions)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!questionText.trim()) {
            setError('Teks pertanyaan tidak boleh kosong')
            return
        }

        if (isOptionType) {
            const validOptions = options.filter(o => o.trim() !== '')
            if (validOptions.length < 2) {
                setError('Pilihan ganda/checkbox minimal harus memiliki 2 opsi')
                return
            }
        }

        setLoading(true)

        try {
            const payload = {
                question_text: questionText,
                question_type: questionType,
                options: isOptionType ? options.filter(o => o.trim() !== '') : []
            }

            await updateSurveyQuestion(surveyId, questionId, payload)

            // Success, redirect back
            router.push(`/my-surveys/${surveyId}`)
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan saat menyimpan data')
        } finally {
            setLoading(false)
        }
    }

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-gray-100 p-6 flex justify-center items-center">
                <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Back Link */}
                <Link
                    href={`/my-surveys/${surveyId}`}
                    className="text-blue-600 text-sm hover:underline mb-4 inline-block"
                >
                    ← Batal Edit
                </Link>

                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Pertanyaan</h1>

                    {error && (
                        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Question Text */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Pertanyaan
                            </label>
                            <textarea
                                value={questionText}
                                onChange={(e) => setQuestionText(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 placeholder-gray-400 bg-white"
                                rows={3}
                                placeholder="Tuliskan pertanyaanmu di sini..."
                                required
                            />
                        </div>

                        {/* Question Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipe Jawaban
                            </label>
                            <select
                                value={questionType}
                                onChange={(e) => setQuestionType(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 bg-white"
                            >
                                <option value="text">Teks Pendek (Jawaban Singkat)</option>
                                <option value="radio">Pilihan Ganda (Satu Jawaban)</option>
                                <option value="checkbox">Kotak Centang (Banyak Jawaban)</option>
                            </select>
                        </div>

                        {/* Options Builder */}
                        {isOptionType && (
                            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                                <label className="block text-sm font-medium text-gray-700">
                                    Opsi Jawaban
                                </label>
                                
                                {options.map((opt, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <div className="shrink-0 text-gray-400">
                                            {questionType === 'radio' ? '○' : '□'}
                                        </div>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            placeholder={`Opsi ${index + 1}`}
                                            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 placeholder-gray-400 bg-white"
                                            required
                                        />
                                        {options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOption(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                title="Hapus opsi"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    + Tambah Opsi Lainnya
                                </button>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-4 border-t">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3 rounded-lg text-white font-medium transition-colors ${
                                    loading 
                                        ? 'bg-blue-400 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
