import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle,
  Target,
  Users,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { authService } from '../services/authService';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isRegister && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await authService.register(email, password, name.trim());
      } else {
        await authService.login(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email address or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 md:p-8 lg:p-12 relative overflow-hidden antialiased">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Grid */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10">
        
        {/* Left Column: Product Value Showcase (visible on all screens, stacks naturally) */}
        <div className="lg:col-span-7 space-y-6 text-white order-2 lg:order-1">
          {/* Category Pill */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Sales Management System</span>
          </div>

          {/* Master Headline */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30 shrink-0">
                <Compass className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">KRG ONE PMS</h1>
                <p className="text-xs font-extrabold text-blue-400 uppercase tracking-widest mt-0.5">Your Intelligent Sales Assistant</p>
              </div>
            </div>
            <p className="text-sm lg:text-base text-slate-300 font-medium leading-relaxed max-w-xl">
              Designed to help business founders, leadership teams, and sales managers maintain complete visibility and control over their sales operations without manual chasing.
            </p>
          </div>

          {/* Two Connected Modes Showcase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Mode 1: Lead CRM */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 space-y-2.5 transition-all duration-200 shadow-md">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <h3 className="font-extrabold text-sm text-white">Lead Management CRM</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Manage leads, customer directory, sales pipeline, lead allocation, and 1-click WhatsApp & Hostinger Email outreach.
                </p>
              </div>
            </div>

            {/* Mode 2: Sales Performance */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 space-y-2.5 transition-all duration-200 shadow-md">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <h3 className="font-extrabold text-sm text-white">Sales Performance</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Set sales targets, monitor team pacing, review salesperson-wise achievements, and log manager coaching action items.
                </p>
              </div>
            </div>
          </div>

          {/* Value Checklist */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center space-x-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong className="text-white">Zero Scattered Spreadsheets</strong> — Centralized database for businesses and outreach.</span>
            </div>
            <div className="flex items-center space-x-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong className="text-white">Founder Visibility & Control</strong> — Real-time tracking of pending follow-ups and performance.</span>
            </div>
            <div className="flex items-center space-x-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong className="text-white">Seamless 1-Click Workspace Switch</strong> — Move between CRM pipeline and target dashboards.</span>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-[11px] text-slate-500 font-semibold pt-1">
            KRGONE Business Consulting & Technologies • Built for Business Founders & Sales Teams
          </div>
        </div>

        {/* Right Column: Sign In / Create Account Card */}
        <div className="lg:col-span-5 flex justify-center order-1 lg:order-2">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Header Branding */}
            <div className="bg-slate-950 p-7 text-center border-b border-slate-800">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white mb-3 shadow-lg shadow-blue-500/20">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">KRG ONE PMS</h2>
              <p className="text-xs font-bold text-blue-400 mt-1 uppercase tracking-wider">Your Intelligent Sales Assistant</p>
              <p className="text-[11px] text-slate-400 mt-1">Built for Business Founders & Sales Teams</p>
            </div>

            {/* Form Container */}
            <div className="p-7">
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(''); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    !isRegister ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(''); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    isRegister ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 mt-6 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>{isRegister ? 'Register Account' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
