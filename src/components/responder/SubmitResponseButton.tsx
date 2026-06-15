"use client";

import { useState, useEffect } from "react";
import { submitSurveyResponse } from "@/services/response.service";
import { supabase } from "@/lib/supabase";

export interface SubmitResponseResult {
  id: string;
  score: number;
  score_breakdown: Record<string, any>;
  status: string;
  reward_final: number;
  created_at: string;
}

export default function SubmitResponseButton({
  surveyId: initialSurveyId,
  onSuccessCallback,
  onSubmitStart,
  onSubmitError,
  hasSubmitted: initialHasSubmitted,
  disabled: externalDisabled,
}: {
  surveyId?: string;
  onSuccessCallback?: (result: SubmitResponseResult) => void;
  onSubmitStart?: () => void;
  onSubmitError?: () => void;
  hasSubmitted?: boolean;
  disabled?: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [surveyId, setSurveyId] = useState(initialSurveyId || '');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(initialHasSubmitted || false);

  useEffect(() => {
    if (initialHasSubmitted) {
      setSuccess(true);
    }
  }, [initialHasSubmitted]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!userId) {
      setError("You must be logged in to submit a response.");
      return;
    }

    setIsLoading(true);
    if (onSubmitStart) onSubmitStart();
    setError(null);
    setSuccess(false);

    try {
      const result = await submitSurveyResponse({
        survey_id: surveyId,
      });

      setSuccess(true);
      if (onSuccessCallback && result?.response) {
        onSuccessCallback(result.response as SubmitResponseResult);
      } else if (onSuccessCallback) {
        // Fallback if response details weren't returned
        onSuccessCallback({ id: '', score: 0, score_breakdown: {}, status: 'pending', reward_final: 0, created_at: new Date().toISOString() });
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      if (onSubmitError) onSubmitError();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-sm">
      {!initialSurveyId && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Survey ID</label>
          <input 
            type="text" 
            value={surveyId}
            onChange={e => setSurveyId(e.target.value)}
            disabled={success}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow disabled:bg-gray-100"
            placeholder="Enter survey UUID"
          />
        </div>
      )}

      <button 
        onClick={handleSubmit} 
        disabled={isLoading || !userId || success || externalDisabled}
        className={`mt-2 px-6 py-2.5 font-medium text-white rounded-lg transition-all duration-200 flex justify-center ${
          isLoading || !userId || success || externalDisabled
            ? "bg-gray-400 cursor-not-allowed opacity-70" 
            : "bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md hover:shadow-lg cursor-pointer"
        }`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </span>
        ) : !userId ? (
          "Please log in to submit"
        ) : success ? (
          "Response Submitted ✓"
        ) : (
          "Submit Response"
        )}
      </button>

      {error && (
        <div className="text-red-500 bg-red-50 px-4 py-3 rounded-md border border-red-100 text-sm break-words">
          {error}
        </div>
      )}
    </div>
  );
}
