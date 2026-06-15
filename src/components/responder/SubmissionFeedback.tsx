"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { SubmitResponseResult } from "./SubmitResponseButton";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  valid:       { label: "Valid",       color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: "✅" },
  low_quality: { label: "Low Quality", color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: "⚠️" },
  rejected:    { label: "Rejected",    color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     icon: "❌" },
  pending:     { label: "Pending",     color: "text-gray-600",    bg: "bg-gray-50",     border: "border-gray-200",    icon: "⏳" },
};

function formatDuration(seconds: number) {
  if (!seconds || seconds < 0) return "0s";
  const sec = Math.floor(seconds);
  if (sec < 60) return `${sec}s`;
  
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  
  if (m < 60) return `${m}m ${s}s`;
  
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m ${s}s`;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const color =
    clampedScore >= 70 ? "#10b981" : clampedScore >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth="10"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
        />
      </svg>
      <span
        className="absolute text-2xl font-extrabold"
        style={{ color }}
      >
        {clampedScore}
      </span>
    </div>
  );
}

export default function SubmissionFeedback({
  result,
  surveyTitle,
  onClose,
}: {
  result: SubmitResponseResult;
  surveyTitle?: string;
  onClose?: () => void;
}) {
  const status = STATUS_CONFIG[result.status] ?? STATUS_CONFIG.pending;
  const bd = result.score_breakdown ?? {};

  const rewardFormatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(result.reward_final ?? 0);

  const hasBreakdown = Object.keys(bd).length > 0;

  useEffect(() => {
    // Lock scroll
    document.body.style.overflow = 'hidden';
    
    // Cleanup: restore scroll
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="feedback-enter relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-6 m-auto">
        {onClose && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column: Banner, Score, Reward */}
          <div className="flex-1 space-y-4">
            {/* Top banner */}
            <div className={`rounded-xl border ${status.border} ${status.bg} p-5 text-center flex flex-col items-center justify-center`}>
              <div className="text-4xl mb-1">{status.icon}</div>
              <h2 className={`text-2xl font-extrabold mb-1 ${status.color}`}>
                Response {status.label}
              </h2>
              <p className="text-sm text-gray-500">
                {surveyTitle ? `"${surveyTitle}" — ` : ""}
                {result.status === "valid"
                  ? "Great job! Your response passed quality checks."
                  : result.status === "low_quality"
                  ? "Your response was accepted at reduced reward."
                  : result.status === "rejected"
                  ? "Your response did not meet quality requirements."
                  : "Your response is being processed."}
              </p>
            </div>

            {/* Score + Reward row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Score ring */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Score</p>
                <ScoreRing score={result.score} />
              </div>

              {/* Reward */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Reward Earned</p>
                <p className={`text-2xl font-extrabold ${(result.reward_final ?? 0) > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                  {rewardFormatted}
                </p>
                {(result.reward_final ?? 0) === 0 && (
                  <p className="text-xs text-gray-400 mt-1 leading-tight">No reward for this response</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Score Breakdown */}
          {hasBreakdown && (
            <div className="w-full md:w-80 shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span>🧮</span> Score Breakdown
                </h3>

                <div className="space-y-2 text-sm font-mono text-gray-600 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">+ Base Score</span>
                    <span className="font-bold">{bd.base ?? 100}</span>
                  </div>

                  {(bd.time_penalty ?? 0) !== 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Time Penalty ({formatDuration(bd.duration)})</span>
                      <span className="font-bold">{Math.abs(bd.time_penalty)}</span>
                    </div>
                  )}
                  {(bd.essay_penalty ?? 0) !== 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Essay Penalty</span>
                      <span className="font-bold">{Math.abs(bd.essay_penalty)}</span>
                    </div>
                  )}
                  {(bd.reputation_penalty ?? 0) !== 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Reputation Penalty</span>
                      <span className="font-bold">{Math.abs(bd.reputation_penalty)}</span>
                    </div>
                  )}
                  {(bd.reputation_bonus ?? 0) !== 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span>+ Reputation Bonus</span>
                      <span className="font-bold">{bd.reputation_bonus}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-2 flex justify-between items-center font-bold text-gray-900 text-base">
                    <span>Final Score</span>
                    <span>{bd.final_score ?? result.score}</span>
                  </div>
                </div>

                {/* Duration + Attention Check */}
                <div className="space-y-3 mt-4">
                  {bd.duration !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">⏱ Duration</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-800 font-medium">
                          {formatDuration(bd.duration)}
                          <span className="text-gray-400 font-normal"> / {formatDuration(bd.min_duration)}</span>
                        </p>
                        {bd.duration >= bd.min_duration ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Normal ✓</span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">Too Fast ❌</span>
                        )}
                      </div>
                    </div>
                  )}
                  {bd.attention_check !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">🧠 Attention</p>
                      <p className="text-sm font-medium">
                        {bd.attention_check === "passed" ? (
                          <span className="text-emerald-700 font-bold">PASSED ✅</span>
                        ) : bd.attention_check === "failed" ? (
                          <span className="text-red-700 font-bold">FAILED ❌</span>
                        ) : (
                          <span className="text-gray-500 capitalize">{bd.attention_check}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          {result.id && (
            <Link
              href={`/my-responses/${result.id}`}
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 text-sm"
            >
              View Full Details →
            </Link>
          )}
          <Link
            href="/responder"
            className="flex-1 text-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200 py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
