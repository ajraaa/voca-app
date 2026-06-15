import Link from 'next/link';
import { Survey } from '@/types/survey.types';

interface SurveyCardProps {
    survey: Survey;
}

const STATUS_CONFIG = {
    active:    { label: 'Aktif',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',  progressBar: 'from-emerald-400 to-emerald-500' },
    paused:    { label: 'Paused',    dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200',        progressBar: 'from-amber-400 to-amber-500' },
    completed: { label: 'Selesai',   dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200',           progressBar: 'from-blue-400 to-blue-500' },
    draft:     { label: 'Draft',     dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-600 border-gray-200',           progressBar: 'from-gray-300 to-gray-400' },
} as const;

export default function SurveyCard({ survey: s }: SurveyCardProps) {
    const completed = s.total_responses - s.remaining_responses;
    const progress = s.total_responses > 0
        ? Math.round((completed / s.total_responses) * 100)
        : 0;
    const totalSpend = completed * s.reward_per_response;
    const status = (s.status ?? 'draft') as keyof typeof STATUS_CONFIG;
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

    return (
        <Link
            href={`/my-surveys/${s.id}`}
            className="group block min-w-0 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300/80 hover:shadow-lg sm:p-6"
        >
            {/* Top row: Title + Badges */}
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="min-w-0 truncate text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-blue-700">
                        {s.title || 'Untitled Survey'}
                    </h2>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {/* Status Badge */}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                    </span>
                    {/* Mode Badge */}
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                        s.allow_extended_responses
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}>
                        {s.allow_extended_responses ? '🚀' : '🔒'}
                    </span>
                </div>
            </div>

            {/* Progress */}
            <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-500">Progress Responden</span>
                    <span className="font-bold text-gray-700">{completed}<span className="font-normal text-gray-400">/{s.total_responses}</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${cfg.progressBar}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="text-right text-[10px] font-semibold text-gray-400">{progress}%</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50/80 px-3 py-2.5">
                <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Reward</p>
                    <p className="truncate text-xs font-bold text-blue-600">
                        {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0
                        }).format(s.reward_per_response)}
                    </p>
                </div>
                <div className="min-w-0 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Sisa Slot</p>
                    <p className="text-xs font-bold text-gray-700">{s.remaining_responses}</p>
                </div>
                <div className="min-w-0 text-right">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Terpakai</p>
                    <p className="truncate text-xs font-bold text-gray-700">
                        {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0
                        }).format(totalSpend)}
                    </p>
                </div>
            </div>

            {/* Footer arrow */}
            <div className="mt-3 flex justify-end">
                <span className="text-xs font-semibold text-gray-300 transition-colors group-hover:text-blue-500">
                    Lihat Detail →
                </span>
            </div>
        </Link>
    );
}
