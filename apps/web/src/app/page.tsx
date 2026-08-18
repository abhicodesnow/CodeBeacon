'use client';

import { useState } from 'react';

export default function CodeBeaconDebugger() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Sidebar State - Closed by default
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Empty History (Ready for Supabase data)
  const history: any[] = [];

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    
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

  return (
    <div className="flex h-screen w-full bg-black text-gray-200 font-sans overflow-hidden relative">
      
      {/* --- AESTHETIC BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Layer 1: The blurred blue neon glow behind the dots */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(59,130,246,0.8)_1px,transparent_1px)] [background-size:20px_20px] blur-[2px] opacity-30"></div>

        {/* Layer 2: The sharp, brighter core dots */}
        <div className="absolute inset-0 bg-[radial-gradient(#4a4a4a_1px,transparent_1px)] [background-size:20px_20px] opacity-70"></div>

        {/* Top center ambient glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 blur-[120px] rounded-full"></div>

        {/* Subtle dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#2a2a2a_1px,transparent_1px)] [background-size:20px_20px] opacity-30"></div>

        {/* Top center glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full"></div>
      </div>

      {/* --- SIDEBAR (Push Animation Fixed) --- */}
      <div 
        className={`relative z-20 flex flex-col bg-[#0a0a0a]/90 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap flex-shrink-0 ${
          isSidebarOpen ? 'w-72 opacity-100 border-r border-gray-800/60' : 'w-0 opacity-0 border-none'
        }`}
      >
        {/* Inner container pinned to 72px width so text doesn't squish during transition */}
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
            
            {/* Toggle Button */}
            <button 
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="text-gray-400 hover:text-white transition-colors focus:outline-none p-1 -ml-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Logo */}
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
          
          {/* Auth Area */}
          <div className="flex items-center space-x-5">
            <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Log in
            </button>
            <button className="text-sm font-medium bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 px-5 py-1.5 rounded-full transition-all duration-300">
              Sign up
            </button>
          </div>
        </header>

        {/* Editor Wrapper */}
        <main className="flex-1 flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto">
          
          {/* Main Interface Card */}
          <div className="w-full bg-[#0d0d0d]/80 backdrop-blur-xl border border-gray-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            
            {/* Top Bar / Language Selector */}
            <div className="flex items-center justify-between bg-black/50 px-6 py-4 border-b border-gray-800/60">
              <div className="flex space-x-2 bg-[#1a1a1a] p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => setLanguage('cpp')}
                  className={`px-4 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                    language === 'cpp' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm' : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  C++
                </button>
                <button
                  onClick={() => setLanguage('py')}
                  className={`px-4 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                    language === 'py' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm' : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  Python
                </button>
              </div>
              <div className="text-xs text-gray-500 font-mono flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-full border border-gray-800">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                <span>Worker Online</span>
              </div>
            </div>

            {/* Code Editor Area */}
            <div className="p-0 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`// Drop your ${language === 'cpp' ? 'C++' : 'Python'} logic here...\n\nint main() {\n  return 0;\n}`}
                className="w-full h-[400px] bg-transparent text-gray-300 font-mono text-sm p-6 focus:outline-none resize-none placeholder-gray-700 selection:bg-blue-500/30"
                spellCheck="false"
              />
            </div>

            {/* Action Bar */}
            <div className="px-6 py-5 flex justify-between items-center bg-black/30 border-t border-gray-800/60">
              <div className="flex-1">
                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !code.trim()}
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

          {/* Results Section */}
          {result !== null && (
            <div className={`mt-8 max-w-xl w-full border ${result > 50 ? 'border-red-900/50 bg-red-900/10 shadow-[0_0_30px_rgba(185,28,28,0.1)]' : result > 20 ? 'border-yellow-900/50 bg-yellow-900/10 shadow-[0_0_30px_rgba(202,138,4,0.1)]' : 'border-green-900/50 bg-green-900/10 shadow-[0_0_30px_rgba(21,128,61,0.1)]'} rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 backdrop-blur-sm`}>
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