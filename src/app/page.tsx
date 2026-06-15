"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      router.push("/");
      router.refresh();
    } else {
      console.error("Error logging out:", error.message);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        if (isAdmin(user.email)) {
          setIsRedirecting(true);
          router.push('/admin/withdrawals');
          return;
        }
        const lastWorkspace = localStorage.getItem('lastWorkspace');
        if (lastWorkspace === 'creator') {
          setIsRedirecting(true);
          router.push('/creator');
          return;
        } else if (lastWorkspace === 'responder') {
          setIsRedirecting(true);
          router.push('/responder');
          return;
        }
      }
      setLoading(false);
    };

    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        if (isAdmin(session.user.email)) {
          setIsRedirecting(true);
          router.push('/admin/withdrawals');
          return;
        }
        const lastWorkspace = localStorage.getItem('lastWorkspace');
        if (lastWorkspace === 'creator') {
          setIsRedirecting(true);
          router.push('/creator');
        } else if (lastWorkspace === 'responder') {
          setIsRedirecting(true);
          router.push('/responder');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Loading or redirecting state
  if (loading || isRedirecting) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-lg animate-pulse">
            V
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mt-2">Preparing Workspace</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Sleek Floating Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-black shadow-sm">
            V
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">Voca</span>
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-bold text-gray-700 hover:text-gray-950 hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Register
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-gray-500 hidden sm:inline">Signed in as {user.email}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100/80 rounded-lg border border-red-100 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {!user ? (
        /* Guest Marketing View */
        <main className="flex min-h-screen flex-col items-center bg-gray-50 pt-24 pb-16 px-4 sm:px-6">
          <div className="w-full max-w-6xl flex flex-col items-center gap-16">
            
            {/* Hero Section */}
            <div className="text-center space-y-6 max-w-3xl mt-8">
              <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight leading-none">
                Gather High-Quality Insights.<br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Earn Real Rewards.
                </span>
              </h1>
              <p className="text-gray-500 text-lg sm:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
                Voca connects survey creators with verified human respondents, leveraging automated attention verification and instant secure wallet withdrawals.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link
                  href="/register"
                  className="px-8 py-4 w-full sm:w-auto text-base font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Create Your First Survey
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-4 w-full sm:w-auto text-base font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-2xl shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  Start Answering Surveys
                </Link>
              </div>
            </div>

            {/* Split Creator/Responder Marketing Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
              
              {/* Creator Showcase */}
              <div className="bg-white rounded-3xl border border-gray-150 p-8 sm:p-10 shadow-sm flex flex-col justify-between gap-8 hover:shadow-md transition-shadow">
                <div className="space-y-6">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-gray-900">For Survey Creators</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Launch custom campaigns targeting verified target responder profiles and view rich feedback graphs instantly.
                    </p>
                  </div>
                  <ul className="space-y-3.5 text-sm text-gray-600 font-medium">
                    <li className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs">✓</span>
                      Smart verification attention check filters
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs">✓</span>
                      Real-time interactive dashboard analytics
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs">✓</span>
                      Automatic budget recommendation algorithm
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="w-full py-4 text-center text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100/85 active:scale-95 transition-all rounded-xl cursor-pointer"
                >
                  Create Creator Account
                </Link>
              </div>

              {/* Respondent Showcase */}
              <div className="bg-white rounded-3xl border border-gray-150 p-8 sm:p-10 shadow-sm flex flex-col justify-between gap-8 hover:shadow-md transition-shadow">
                <div className="space-y-6">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-gray-900">For Survey Respondents</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Share high-quality inputs on topics you care about and receive instant rewards straight to your balance.
                    </p>
                  </div>
                  <ul className="space-y-3.5 text-sm text-gray-600 font-medium">
                    <li className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">✓</span>
                      Instant payout secure e-wallet withdrawals
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">✓</span>
                      100% privacy-protected user data
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">✓</span>
                      Fair reward payouts per minute of survey
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="w-full py-4 text-center text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/85 active:scale-95 transition-all rounded-xl cursor-pointer"
                >
                  Create Respondent Account
                </Link>
              </div>

            </div>

            {/* Platform statistics / Social Proof */}
            <div className="w-full border-t border-gray-200 pt-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-3xl font-extrabold text-gray-900">100%</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Verified Humans</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-blue-600">Rp0</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Minimum Deposit</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-emerald-600">Instant</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Wallet Withdrawal</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-gray-900">&lt; 1 min</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Deployment Time</p>
              </div>
            </div>

          </div>
        </main>
      ) : (
        /* Authenticated Dashboard Selector */
        <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gray-50 pt-24 md:pt-28">
          <div className="w-full max-w-4xl flex flex-col items-center gap-8 md:gap-12">
            {/* Welcome Header */}
            <div className="text-center space-y-3 max-w-xl">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Welcome back, {user.email?.split('@')[0]}</h1>
              <p className="text-gray-500 text-lg leading-relaxed">
                Choose your workspace experience below to continue.
              </p>
            </div>

            {/* Visual Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Creator Card */}
              <div className="group bg-white p-8 rounded-2xl border border-gray-150 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-blue-100/60 px-2.5 py-0.5 text-xs font-semibold text-blue-800 mb-2">
                      Deploy & Analyze
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Creator Workspace</h2>
                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                      Design beautiful interactive surveys, target specific respondent profiles, verify entries with custom attention checks, and view smart analytical reports.
                    </p>
                  </div>
                </div>
                
                <Link
                  href="/creator"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  Enter Creator Mode
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>

              {/* Respondent Card */}
              <div className="group bg-white p-8 rounded-2xl border border-gray-150 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 mb-2">
                      Share & Earn
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Respondent Workspace</h2>
                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                      Browse open surveys tailored to you, provide high-quality responses, complete attention-verification steps, and earn instant rewards straight to your wallet.
                    </p>
                  </div>
                </div>

                <Link
                  href="/responder"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  Enter Respondent Mode
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </main>
      )}
    </>
  )
}
