'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSurveyQuestion } from '@/services/survey.service'

type Mode = 'choose' | 'regular' | 'validation'
type ValidationType = 'radio' | 'checkbox'

export default function AddQuestionPage() {
    const params = useParams()
    const router = useRouter()
    const surveyId = params.id as string

    const [mode, setMode] = useState<Mode>('choose')
    const [validationType, setValidationType] = useState<ValidationType>('radio')

    // Regular question state
    const [questionText, setQuestionText] = useState('')
    const [questionType, setQuestionType] = useState('text')
    const [options, setOptions] = useState<string[]>(['', ''])

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isOptionType = questionType === 'radio' || questionType === 'checkbox'

    const handleAddOption = () => setOptions([...options, ''])
    const handleRemoveOption = (index: number) => setOptions(options.filter((_, i) => i !== index))
    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options]
        newOptions[index] = value
        setOptions(newOptions)
    }

    const handleReset = () => {
        setMode('choose')
        setQuestionText('')
        setOptions(['', ''])
        setQuestionType('text')
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (mode === 'regular') {
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
        }

        setLoading(true)

        try {
            const payload: any = mode === 'validation'
                ? {
                    question_text: '', // akan di-override oleh API
                    question_type: validationType,
                    options: [],
                    is_attention_check: true,
                }
                : {
                    question_text: questionText,
                    question_type: questionType,
                    options: isOptionType ? options.filter(o => o.trim() !== '') : [],
                }

            await createSurveyQuestion(surveyId, payload)
            router.push(`/my-surveys/${surveyId}`)
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan saat menyimpan data')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-2xl mx-auto">
                <Link
                    href={`/my-surveys/${surveyId}`}
                    className="text-blue-600 text-sm hover:underline mb-4 inline-block"
                >
                    ← Kembali ke Detail Survey
                </Link>

                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Tambah Pertanyaan</h1>
                        {mode !== 'choose' && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
                            >
                                ← Ganti Tipe
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    {/* STEP 1: Mode Selection */}
                    {mode === 'choose' && (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 mb-4">Pilih jenis pertanyaan yang ingin kamu tambahkan:</p>

                            {/* Card: Regular Question */}
                            <button
                                type="button"
                                onClick={() => setMode('regular')}
                                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-xl shrink-0 group-hover:bg-blue-200 transition-colors">
                                        📝
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Pertanyaan Biasa</p>
                                        <p className="text-sm text-gray-500">Buat pertanyaan teks, pilihan ganda, atau checkbox sesuai kebutuhanmu.</p>
                                    </div>
                                    <span className="ml-auto text-gray-300 group-hover:text-blue-400 text-lg">→</span>
                                </div>
                            </button>

                            {/* Card: Validation Question */}
                            <button
                                type="button"
                                onClick={() => setMode('validation')}
                                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-xl shrink-0 group-hover:bg-amber-200 transition-colors">
                                        🛡️
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Pertanyaan Validasi</p>
                                        <p className="text-sm text-gray-500">Gunakan template anti-fraud yang sudah terstandar untuk mendeteksi responden asal-asalan.</p>
                                    </div>
                                    <span className="ml-auto text-gray-300 group-hover:text-amber-400 text-lg">→</span>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* STEP 2A: Regular Question Form */}
                    {mode === 'regular' && (
                        <form onSubmit={handleSubmit} className="space-y-6">
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
                                                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 bg-white"
                                                placeholder={`Opsi ${index + 1}`}
                                                required
                                            />
                                            {options.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveOption(index)}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleAddOption}
                                        className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"
                                    >
                                        <span>+</span> Tambah Opsi
                                    </button>
                                </div>
                            )}

                            <div className="pt-4 border-t">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-3 rounded-lg text-white font-medium transition-colors ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Pertanyaan'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 2B: Validation Question Form */}
                    {mode === 'validation' && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Info Banner */}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                                <span className="text-2xl">🛡️</span>
                                <div>
                                    <p className="font-semibold text-amber-800 text-sm">Pertanyaan Validasi</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        Teks soal dan jawaban benar sudah ditentukan sistem secara otomatis untuk mencegah kecurangan. Kamu hanya perlu memilih tipenya.
                                    </p>
                                </div>
                            </div>

                            {/* Validation Type Picker */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Pilih Tipe Template Validasi
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setValidationType('radio')}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${validationType === 'radio' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'}`}
                                    >
                                        <p className="text-2xl mb-1">🔘</p>
                                        <p className="font-semibold text-sm text-gray-800">Pilihan Ganda</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Responden memilih satu jawaban yang benar.</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setValidationType('checkbox')}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${validationType === 'checkbox' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'}`}
                                    >
                                        <p className="text-2xl mb-1">☑️</p>
                                        <p className="font-semibold text-sm text-gray-800">Kotak Centang</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Responden mencentang opsi yang sesuai instruksi.</p>
                                    </button>
                                </div>
                            </div>

                            {/* Preview (locked) */}
                            <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl opacity-80">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Pratinjau Soal (Dikunci Sistem)</p>
                                {validationType === 'radio' ? (
                                    <>
                                        <p className="text-sm text-gray-700 mb-3">Untuk memastikan kualitas, pilih jawaban &apos;Sangat Setuju&apos;.</p>
                                        <div className="space-y-1.5">
                                            {["Sangat Setuju ✅", "Setuju", "Tidak Setuju"].map((opt, i) => (
                                                <div key={i} className={`flex items-center gap-2 text-sm ${i === 0 ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                                                    <span>○</span> {opt}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-700 mb-3">Pilih opsi &apos;Warna Merah&apos; untuk validasi.</p>
                                        <div className="space-y-1.5">
                                            {["Warna Merah ✅", "Warna Biru", "Warna Hijau"].map((opt, i) => (
                                                <div key={i} className={`flex items-center gap-2 text-sm ${i === 0 ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                                                    <span>□</span> {opt}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="pt-4 border-t">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-3 rounded-lg text-white font-medium transition-colors ${loading ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}
                                >
                                    {loading ? 'Menyimpan...' : '🛡️ Tambah Pertanyaan Validasi'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
