'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  initialTab: 'profile' | 'settings';
  // NEW: Props to control Vim mode
  vimMode: boolean;
  setVimMode: (val: boolean) => void;
}

export default function ProfileSettingsModal({ isOpen, onClose, user, initialTab, vimMode, setVimMode }: ProfileSettingsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>(initialTab);
  const [isSaving, setIsSaving] = useState(false);
  
  // NEW: Hold the draft state until the user clicks save
  const [tempVimMode, setTempVimMode] = useState(vimMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setTempVimMode(vimMode); // Sync draft state when opened
    }
  }, [isOpen, initialTab, vimMode]);

  if (!isOpen || !mounted) return null;

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setVimMode(tempVimMode); // Apply the setting to the editor!
      setIsSaving(false);
      onClose();
    }, 800);
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.user_name || 'Developer';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      ></div>

      <div className="w-full max-w-2xl h-[500px] flex bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
        
        <div className="w-48 bg-[#141414] border-r border-gray-800 p-4 flex flex-col space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Account</h3>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'profile' ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span>Public Profile</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'settings' ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>Editor Settings</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'profile' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-white mb-2">Public Profile</h2>
                
                <div className="flex items-center space-x-6 pb-6 border-b border-gray-800">
                  <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-3xl text-gray-500">{userName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <button className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-sm text-gray-300 font-medium px-4 py-2 rounded-lg border border-gray-700 transition-colors">
                      Change Avatar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
                    <input type="text" defaultValue={userName} className="w-full bg-[#141414] border border-gray-800 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
                    <input type="text" disabled defaultValue={user?.email} className="w-full bg-[#0d0d0d] border border-gray-800/50 rounded-lg px-3 py-2 text-gray-500 text-sm cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Codeforces Handle</label>
                    <input type="text" placeholder="e.g. tourist" className="w-full bg-[#141414] border border-gray-800 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">LeetCode Handle</label>
                    <input type="text" placeholder="e.g. neetcode" className="w-full bg-[#141414] border border-gray-800 rounded-lg px-3 py-2 text-gray-200 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-white mb-6">Editor Settings</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#141414] border border-gray-800 rounded-xl">
                    <div>
                      <h4 className="text-sm font-medium text-gray-200">Vim Keybindings</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Enable Vim mode in the Monaco Editor</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      {/* NEW: Bind toggle to temporary state */}
                      <input 
                        type="checkbox" 
                        checked={tempVimMode} 
                        onChange={(e) => setTempVimMode(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#141414] border border-gray-800 rounded-xl">
                    <div>
                      <h4 className="text-sm font-medium text-gray-200">Format on Save</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Automatically format code with Prettier</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-800 bg-[#0a0a0a] flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-white hover:bg-gray-200 text-black font-semibold py-2 px-6 rounded-lg transition-colors text-sm flex items-center"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving...
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}