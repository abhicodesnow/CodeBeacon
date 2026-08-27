'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import AuthModal from './AuthModal';

// Sleek anonymous avatar fallback
const DefaultAvatar = () => (
  <div className="w-full h-full bg-[#141414] flex items-center justify-center">
    <svg className="w-3/5 h-3/5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0112.28 0C16.43 19.18 14.03 20 12 20z"/>
    </svg>
  </div>
);

export default function UserWidget() {
  const [user, setUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [defaultIsSignUp, setDefaultIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (err) {
        console.error("Supabase connection error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setImgError(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Close dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
  };

  const openAuthModal = (isSignUp: boolean) => {
    setDefaultIsSignUp(isSignUp);
    setIsAuthModalOpen(true);
  };

  // Check both avatar_url (GitHub/Discord) and picture (Google)
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.user_name || 'Developer';
  const userEmail = user?.email;

  if (loading) return <div className="w-20 h-10 animate-pulse bg-gray-800 rounded-lg"></div>;

  return (
    <div className="relative" ref={dropdownRef}>
      
      {!user ? (
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => openAuthModal(false)} 
            className="text-gray-300 hover:text-white font-medium transition-colors"
          >
            Log In
          </button>
          <button 
            onClick={() => openAuthModal(true)} 
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]"
          >
            Sign Up
          </button>
        </div>
      ) : (
        <div>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-700 hover:border-blue-500 transition-colors shadow-lg focus:outline-none flex items-center justify-center bg-[#141414]"
          >
            {avatarUrl && !imgError ? (
              <img 
                src={avatarUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)} 
              />
            ) : (
              <DefaultAvatar />
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-64 bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              
              <div className="p-4 border-b border-gray-800 bg-[#141414]">
                <p className="text-sm font-semibold text-white truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{userEmail}</p>
              </div>
              
              <div className="p-2 flex flex-col space-y-1">
                <button className="flex items-center space-x-3 w-full p-2.5 rounded-lg text-sm text-gray-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span>Profile</span>
                </button>
                <button className="flex items-center space-x-3 w-full p-2.5 rounded-lg text-sm text-gray-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>Settings</span>
                </button>
              </div>

              <div className="p-2 border-t border-gray-800">
                <button onClick={handleSignOut} className="flex items-center space-x-3 w-full p-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  <span>Sign Out</span>
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        defaultIsSignUp={defaultIsSignUp} 
      />
    </div>
  );
}