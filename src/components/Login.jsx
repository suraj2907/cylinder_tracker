import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { Lock, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, loginWithGoogle } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password!');
      return;
    }
    
    setError(null);
    setLoading(true);
    try {
      const { error: loginErr } = await login(email.trim(), password.trim());
      if (loginErr) {
        setError(loginErr.message || 'Invalid login credentials!');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during sign-in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-inter flex items-center justify-center p-4">
      {/* Login Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl shadow-glass max-w-md w-full p-8 space-y-6 relative overflow-hidden transition-all duration-300 hover:shadow-soft">
        
        {/* Top Decorative Soft Blue Gradient Glow */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-sky-500 via-emerald-500 to-sky-600"></div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Cylinder SVG Badge */}
          <div className="w-14 h-14 rounded-2xl bg-white p-2.5 shadow-md border border-emerald-500/20 flex items-center justify-center">
            <svg viewBox="0 0 512 512" className="w-full h-full">
              <path d="M 190 75 C 190 60 205 50 225 50 L 287 50 C 307 50 322 60 322 75 L 322 110 L 190 110 Z" fill="none" stroke="#dc2626" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="236" y="75" width="40" height="35" rx="6" fill="#fbbf24"/>
              <path d="M 165 190 C 165 125 202 112 256 112 C 310 112 347 125 347 190 L 347 205 L 165 205 Z" fill="#10b981"/>
              <path d="M 165 205 L 347 205 L 347 345 C 347 385 312 400 256 400 C 200 400 165 385 165 345 Z" fill="#ef4444"/>
              <path d="M 190 400 L 322 400 C 322 420 305 430 285 430 L 227 430 C 207 430 190 420 190 400 Z" fill="#ffffff"/>
            </svg>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">M/S. SHREE BALAJI AGENCIES</h2>
            <p className="text-xs text-sky-700 font-extrabold uppercase tracking-widest">🔥 Partner Portal</p>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-[280px]">
            Please sign in to access the Cylinder Tracker and Passbook records.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 text-xs px-4 py-3 rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                placeholder="partner@balaji.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 text-slate-950 placeholder-slate-400 rounded-2xl pl-10 pr-4 py-3.5 text-xs font-semibold transition-all outline-none"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 text-slate-950 placeholder-slate-400 rounded-2xl pl-10 pr-4 py-3.5 text-xs font-semibold transition-all outline-none"
              />
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-black uppercase tracking-wider transition-all shadow-soft flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In to Portal</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 my-2">
          <span className="h-px bg-slate-200 flex-1"></span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Or</span>
          <span className="h-px bg-slate-200 flex-1"></span>
        </div>

        {/* Google Sign-in Button */}
        <button
          type="button"
          onClick={loginWithGoogle}
          className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Sign In with Google</span>
        </button>

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-400 font-bold tracking-wider pt-2 border-t border-slate-100">
          SECURE RLS ACCESS • SHREE BALAJI AGENCIES
        </div>

      </div>
    </div>
  );
}
