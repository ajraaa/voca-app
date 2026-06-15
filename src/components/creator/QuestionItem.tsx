import { Question } from '@/types/survey.types';

interface QuestionItemProps {
    question: Question;
    index: number;
    onEdit?: (questionId: string) => void;
    onDelete?: (questionId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
    text: 'Teks Pendek',
    radio: 'Pilihan Ganda',
    checkbox: 'Kotak Centang',
};

export default function QuestionItem({ question: q, index, onEdit, onDelete }: QuestionItemProps) {
    const isAttentionCheck = q.is_attention_check;

    return (
        <div className={`group relative rounded-xl border p-4 transition-all ${
            isAttentionCheck
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm'
        }`}>
            {/* Number + Question Text */}
            <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    isAttentionCheck ? 'bg-amber-400 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                    {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                        {q.question_text}
                    </p>

                    {/* Type & Validation Badges */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {isAttentionCheck && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                🛡️ Validasi
                            </span>
                        )}
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            {TYPE_LABELS[q.question_type] ?? q.question_type}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex shrink-0 items-center gap-1">
                    {onEdit && !isAttentionCheck && (
                        <button
                            onClick={() => onEdit(q.id)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            title="Edit Pertanyaan"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    )}
                    {onDelete && !isAttentionCheck && (
                        <button
                            onClick={() => onDelete(q.id)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Hapus Pertanyaan"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Options */}
            {q.options && q.options.length > 0 && (
                <ul className="mt-3 space-y-1.5 pl-9">
                    {q.options.map((opt) => {
                        const isCorrect = isAttentionCheck && q.correct_option_id === opt.id;
                        return (
                            <li
                                key={opt.id}
                                className={`flex items-center gap-2 text-sm ${
                                    isCorrect ? 'font-semibold text-emerald-700' : 'text-gray-500'
                                }`}
                            >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                                    isCorrect
                                        ? 'border-emerald-400 bg-emerald-100 text-emerald-600'
                                        : 'border-gray-300 text-gray-300'
                                }`}>
                                    {q.question_type === 'checkbox' ? (isCorrect ? '✓' : '□') : (isCorrect ? '✓' : '○')}
                                </span>
                                {opt.option_text}
                                {isCorrect && (
                                    <span className="text-[10px] font-bold text-emerald-600">(Benar)</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

