'use client'

import { useEffect, useState } from 'react'
import { getCreatorDashboardMetrics } from '@/services/survey.service'

interface DashboardMetrics {
    budget: {
        total: number;
        used: number;
        remaining: number;
    };
    responses: {
        valid: number;
        low_quality: number;
        rejected: number;
        total: number;
        valid_rate: number;
    };
    burn_rate: {
        burn_rate_per_sec: number;
        estimated_minutes_left: number | null;
    };
}

export default function CreatorDashboard() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await getCreatorDashboardMetrics();
                setMetrics(response.data);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Gagal memuat metrik');
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 h-4 w-36 rounded-full bg-gray-200" />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-gray-100" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {error}
            </div>
        );
    }

    if (!metrics) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDuration = (minutes: number) => {
        const hours = minutes / 60;
        if (hours >= 24) {
            const d = Math.floor(hours / 24);
            const remainingHours = Math.floor(hours % 24);
            const remainingMinutes = Math.round((hours % 1) * 60);
            
            if (remainingHours > 0) {
                return `${d} Hari ${remainingHours} Jam`;
            } else if (remainingMinutes > 0) {
                return `${d} Hari ${remainingMinutes} Mnt`;
            } else {
                return `${d} Hari`;
            }
        } else {
            const h = Math.floor(hours);
            const m = Math.round((hours % 1) * 60);
            if (h > 0) {
                if (m > 0) return `${h} Jam ${m} Mnt`;
                return `${h} Jam`;
            }
            return `${m} Menit`;
        }
    };

    const burnRatePerSec = Number(metrics.burn_rate?.burn_rate_per_sec || 0);
    const burnRatePerMinute = burnRatePerSec * 60;
    const estimatedMinutesLeft = metrics.burn_rate?.estimated_minutes_left;
    const hasNoSpendingActivity = burnRatePerSec === 0;
    const cannotPredictTimeLeft = estimatedMinutesLeft === null;

    const validRateColor =
        metrics.responses.valid_rate >= 80 ? { text: 'text-emerald-700', bar: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' } :
        metrics.responses.valid_rate >= 50 ? { text: 'text-amber-700',   bar: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200'   } :
                                             { text: 'text-red-700',     bar: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Section Header */}
            <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Overview Semua Survey
                </h2>
            </div>

            <div className="p-5 space-y-3">

                {/* Row 1 — Budget */}
                <div className="grid grid-cols-3 gap-3">

                    <div className="flex flex-col justify-between rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Total Budget</p>
                        <div>
                            <p className="mt-1 truncate text-xl font-extrabold text-blue-900">{formatCurrency(metrics.budget.total)}</p>
                            <p className="mt-0.5 text-[11px] text-blue-400">Seluruh budget yang terkunci</p>
                        </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Terpakai</p>
                        <div>
                            <p className="mt-1 truncate text-xl font-extrabold text-orange-900">{formatCurrency(metrics.budget.used)}</p>
                            <p className="mt-0.5 text-[11px] text-orange-450 text-orange-400">Budget yang sudah dibayarkan</p>
                        </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-green-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Terkunci</p>
                        <div>
                            <p className="mt-1 truncate text-xl font-extrabold text-emerald-900">{formatCurrency(metrics.budget.remaining)}</p>
                            <p className="mt-0.5 text-[11px] text-emerald-455 text-emerald-400">Budget sisa yang masih terkunci</p>
                        </div>
                    </div>
                </div>

                {/* Row 2 — Stats */}
                <div className="grid grid-cols-2 gap-3">

                    {/* Total Respons */}
                    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Respons</p>
                        <div>
                            <p className="mt-1 text-2xl font-extrabold text-gray-900">{metrics.responses.total}</p>
                            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px]">
                                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{metrics.responses.valid} valid
                                </span>
                                <span className="flex items-center gap-1 font-semibold text-amber-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{metrics.responses.low_quality} low
                                </span>
                                <span className="flex items-center gap-1 font-semibold text-red-500">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{metrics.responses.rejected} rejected
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Valid Rate */}
                    <div className={`flex flex-col justify-between rounded-xl border p-4 ${validRateColor.bg} ${validRateColor.border}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${validRateColor.text}`}>Valid Rate</p>
                        <div>
                            <p className={`mt-1 text-2xl font-extrabold ${validRateColor.text}`}>{metrics.responses.valid_rate.toFixed(1)}%</p>
                            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                                <div
                                    className={`h-full rounded-full transition-all ${validRateColor.bar}`}
                                    style={{ width: `${metrics.responses.valid_rate}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row 3 — Burn Rate & Estimasi Budget Habis */}
                <div className="grid grid-cols-2 gap-3">

                    {/* Burn Rate */}
                    <div className="flex flex-col justify-between rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-amber-50/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Burn Rate</p>
                        <div>
                            {hasNoSpendingActivity ? (
                                <p className="mt-1 text-base font-extrabold text-orange-800">
                                    Belum ada aktivitas
                                </p>
                            ) : (
                                <>
                                    <p className="mt-1 truncate text-xl font-extrabold text-orange-900">
                                        {formatCurrency(burnRatePerMinute)}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-orange-400">per menit</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Estimasi Budget Habis */}
                    <div className="flex flex-col justify-between rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-purple-50/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Estimasi Budget Habis</p>
                        <div>
                            <p className="mt-1 text-base font-extrabold text-violet-800">
                                {cannotPredictTimeLeft ? 'Tidak bisa diprediksi' : formatDuration(Number(estimatedMinutesLeft))}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
 
  );
}

