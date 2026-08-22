'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import AuthModal from '../../components/AuthModal';

// Language to Compiler/Interpreter version mapping
const COMPILERS = {
  cpp: ["GNU G++ 14.1 (C++23)", "GNU G++ 11.4 (C++17)", "Clang 18.1"],
  py: ["Python 3.12.3", "Python 3.11.9", "Python 3.10.14"],
  java: ["Java 21 (LTS)", "Java 17 (LTS)", "Java 11 (LTS)"],
  js: ["Node.js 22.x", "Node.js 20.x (LTS)"],
  rs: ["Rust 1.78.0", "Rust 1.75.0"],
};

// Map file extensions to readable names for the dropdown
const LANGUAGE_NAMES = {
  cpp: "C++",
  py: "Python",
  java: "Java",
  js: "JavaScript",
  rs: "Rust"
};

// Map your state keys to exact Monaco Editor language IDs
const MONACO_LANGUAGES = {
  cpp: "cpp",
  py: "python",
  java: "java",
  js: "javascript",
  rs: "rust"
};

export default function CodeBeaconDebugger() {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<keyof typeof COMPILERS>('cpp');
  const [version, setVersion] = useState(COMPILERS['cpp'][0]);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mouse, setMouse] = useState({ offsetX: 0, offsetY: 0, clientX: -1000, clientY: -1000 });

  // --- Auth Modal State ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const history: any[] = [];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as keyof typeof COMPILERS;
    setLanguage(newLang);
    setVersion(COMPILERS[newLang][0]); 
  };

  const handleAnalyze = async () => {
    if (!code.trim() || !title.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, language }), 
      });

      if (!response.ok) throw new Error('Failed to connect to the AI engine.');

      const data = await response.json();
      setResult(data.data.bug_probability);
    } catch (err) {
      setError('Analysis failed. Ensure your backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const offsetX = (clientX - window.innerWidth / 2) / 40; 
    const offsetY = (clientY - window.innerHeight / 2) / 40;
    setMouse({ offsetX, offsetY, clientX, clientY });
  };

  return (
    <div 
      className="flex h-screen w-full bg-black text-gray-200 font-sans overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
      {/* --- AUTH MODAL --- */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        defaultIsSignUp={isSignUpMode} 
      />

      {/* --- AESTHETIC BACKGROUND WITH PARALLAX --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-[-50px] bg-[radial-gradient(rgba(59,130,246,0.8)_1px,transparent_1px)] [background-size:20px_20px] blur-[2px] opacity-30 transition-transform duration-75 ease-out"
          style={{ transform: `translate(${mouse.offsetX * 0.5}px, ${mouse.offsetY * 0.5}px)` }}
        ></div>
        <div 
          className="absolute inset-[-50px] bg-[radial-gradient(#4a4a4a_1px,transparent_1px)] [background-size:20px_20px] opacity-70 transition-transform duration-75 ease-out"
          style={{ transform: `translate(${mouse.offsetX}px, ${mouse.offsetY}px)` }}
        ></div>
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 blur-[120px] rounded-full"></div>
      </div>

      {/* --- SIDEBAR --- */}
      <div 
        className={`relative z-20 flex flex-col bg-[#0a0a0a]/90 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap flex-shrink-0 ${
          isSidebarOpen ? 'w-72 opacity-100 border-r border-gray-800/60' : 'w-0 opacity-0 border-none'
        }`}
      >
        <div className="w-72 flex flex-col h-full">
          <div className="flex items-center justify-between p-5 border-b border-gray-800/60">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Analysis History</h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
            {history.length === 0 ? (
              <div className="text-gray-500 space-y-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm">No recent scans.<br/>Your history will appear here.</p>
              </div>
            ) : (
              null
            )}
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT LAYOUT --- */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-all duration-300">
        
        {/* Top Navigation Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60 bg-black/40 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="text-gray-400 hover:text-white transition-colors focus:outline-none p-1 -ml-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 hidden sm:block">
                Code<span className="text-blue-500">Beacon</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-5">
            <button 
              onClick={() => {
                setIsSignUpMode(false);
                setIsAuthModalOpen(true);
              }}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => {
                setIsSignUpMode(true);
                setIsAuthModalOpen(true);
              }}
              className="text-sm font-medium bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 px-5 py-1.5 rounded-full transition-all duration-300"
            >
              Sign up
            </button>
          </div>
        </header>

        {/* Editor Wrapper */}
        <main className="flex-1 flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto">
          
          <div className="w-full bg-[#0d0d0d]/80 backdrop-blur-xl border border-gray-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            
            {/* Environment Settings Bar */}
            <div className="flex items-center justify-between bg-black/50 px-6 py-4 border-b border-gray-800/60">
              <div className="flex items-center space-x-4">
                
                {/* Language Dropdown */}
                <div className="relative">
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    className="appearance-none bg-[#1a1a1a] border border-gray-700 text-gray-200 text-sm font-medium rounded-md pl-4 pr-10 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                  >
                    {Object.entries(LANGUAGE_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>

                {/* Version Dropdown */}
                <div className="relative">
                  <select
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="appearance-none bg-[#1a1a1a] border border-gray-700 text-gray-400 text-sm font-medium rounded-md pl-4 pr-10 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                  >
                    {COMPILERS[language].map((ver) => (
                      <option key={ver} value={ver}>{ver}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>

              </div>
            </div>

            {/* Title & Monaco Editor Area */}
            <div className="p-6 relative flex flex-col flex-1">
              {/* Mandatory Title Input */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Snippet Title (e.g., Dijkstra's Algorithm Optimization)..."
                className="w-full bg-transparent text-xl font-bold text-white placeholder-gray-600 focus:outline-none border-b border-gray-800 focus:border-blue-500 pb-3 mb-4 transition-colors relative z-10"
              />

              {/* Monaco Editor Component */}
              <div className="w-full h-[350px] relative z-10 rounded-lg overflow-hidden border border-gray-800/50">
                <Editor
                  height="100%"
                  language={MONACO_LANGUAGES[language]}
                  theme="vs-dark"
                  value={code}
                  onChange={(value: string | undefined) => setCode(value || '')}
                  options={{
                    minimap: { enabled: false }, // Hides the mini-map to save space
                    fontSize: 14,
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on",
                    formatOnPaste: true,
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      Initializing Editor...
                    </div>
                  }
                />
              </div>
            </div>

            <div className="px-6 py-5 flex justify-between items-center bg-black/30 border-t border-gray-800/60 relative z-10">
              <div className="flex-1 flex items-center space-x-3">
                {!title.trim() && (
                  <span className="text-xs text-yellow-500/80 font-medium tracking-wide flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Title required for analysis
                  </span>
                )}
                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={loading || !code.trim() || !title.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-8 rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 border border-blue-500/50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Extracting AST...</span>
                  </>
                ) : (
                  <span>Run Diagnostics</span>
                )}
              </button>
            </div>
          </div>

          {result !== null && (
            <div className={`mt-8 max-w-xl w-full border ${result > 50 ? 'border-red-900/50 bg-red-900/10 shadow-[0_0_30px_rgba(185,28,28,0.1)]' : result > 20 ? 'border-yellow-900/50 bg-yellow-900/10 shadow-[0_0_30px_rgba(202,138,4,0.1)]' : 'border-green-900/50 bg-green-900/10 shadow-[0_0_30px_rgba(21,128,61,0.1)]'} rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 backdrop-blur-sm relative z-10`}>
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Model Prediction Score</h3>
              <div className="flex items-baseline space-x-1">
                <span className={`text-6xl font-black tracking-tighter ${result > 50 ? 'text-red-500' : result > 20 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {result}%
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-300 max-w-md">
                {result > 50 
                  ? "High risk detected. The cyclomatic complexity is likely too high." 
                  : result > 20 
                  ? "Moderate risk. Consider refactoring for better readability." 
                  : "Syntax parsed successfully. Code is structurally sound."}
              </p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}