'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultIsSignUp?: boolean;
}

export default function AuthModal({ isOpen, onClose, defaultIsSignUp = false }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(defaultIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(defaultIsSignUp);
      setError(null);
      setSuccess(null);
    }
  }, [defaultIsSignUp, isOpen]);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'github' | 'google' | 'twitter' | 'discord') => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || `Failed to initialize ${provider} login.`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-[0_0_50px_rgba(37,99,235,0.15)] overflow-hidden relative">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-blue-600/20 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="p-8 relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Social Logins Grid - YOUR 4 BUTTONS ARE HERE */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => handleOAuth('github')} type="button" className="flex items-center justify-center space-x-2 bg-[#141414] hover:bg-[#1f1f1f] border border-gray-800 rounded-lg px-4 py-2.5 text-gray-300 transition-colors">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              <span className="text-sm font-medium">GitHub</span>
            </button>
            <button onClick={() => handleOAuth('google')} type="button" className="flex items-center justify-center space-x-2 bg-[#141414] hover:bg-[#1f1f1f] border border-gray-800 rounded-lg px-4 py-2.5 text-gray-300 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              <span className="text-sm font-medium">Google</span>
            </button>
            <button onClick={() => handleOAuth('twitter')} type="button" className="flex items-center justify-center space-x-2 bg-[#141414] hover:bg-[#1f1f1f] border border-gray-800 rounded-lg px-4 py-2.5 text-gray-300 transition-colors">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.005 4.15H5.059z"/></svg>
              <span className="text-sm font-medium">X</span>
            </button>
            <button onClick={() => handleOAuth('discord')} type="button" className="flex items-center justify-center space-x-2 bg-[#141414] hover:bg-[#1f1f1f] border border-gray-800 rounded-lg px-4 py-2.5 text-gray-300 transition-colors">
              <svg className="w-5 h-5 fill-current text-[#5865F2]" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
              <span className="text-sm font-medium">Discord</span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#0a0a0a] text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#141414] border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="developer@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#141414] border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="••••••••" />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.2)] disabled:opacity-50 mt-4">
              {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccess(null); }} className="text-blue-500 hover:text-blue-400 font-medium transition-colors">
              {isSignUp ? 'Log in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}