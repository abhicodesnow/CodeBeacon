'use client';

import { useState } from 'react';

export default function CodeBeaconDebugger() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      if (!response.ok) {
        throw new Error('Failed to connect to the AI engine.');
      }

      const data = await response.json();
      setResult(data.data.bug_probability);
    } catch (err) {
      setError('Analysis failed. Ensure your FastAPI backend and Redis worker are running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Header */}
      <div className="max-w-4xl w-full mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          Code<span className="text-blue-500">Beacon</span> AI
        </h1>
        <p className="text-gray-400 text-lg">
          Paste your logic below. Our Random Forest model will analyze the AST and predict the probability of hidden bugs.
        </p>
      </div>

      {/* Main Interface */}
      <div className="max-w-4xl w-full bg-[#121212] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Top Bar / Language Selector */}
        <div className="flex items-center justify-between bg-[#1a1a1a] px-6 py-4 border-b border-gray-800">
          <div className="flex space-x-2">
            <button
              onClick={() => setLanguage('cpp')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                language === 'cpp' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              C++
            </button>
            <button
              onClick={() => setLanguage('py')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                language === 'py' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Python
            </button>
          </div>
          <div className="text-xs text-gray-500 font-mono flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>AI Engine Online</span>
          </div>
        </div>

        {/* Code Editor Area */}
        <div className="p-6 relative">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={`// Paste your ${language === 'cpp' ? 'C++' : 'Python'} code here...`}
            className="w-full h-80 bg-[#0d0d0d] text-gray-300 font-mono text-sm p-4 rounded-xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all placeholder-gray-600"
            spellCheck="false"
          />
        </div>

        {/* Action Bar */}
        <div className="px-6 pb-6 flex justify-between items-center">
          <div>
            {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Analyzing AST...</span>
              </>
            ) : (
              <span>Analyze Code</span>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result !== null && (
        <div className={`mt-8 max-w-xl w-full border ${result > 50 ? 'border-red-900/50 bg-red-900/10' : result > 20 ? 'border-yellow-900/50 bg-yellow-900/10' : 'border-green-900/50 bg-green-900/10'} rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all animate-in fade-in slide-in-from-bottom-4 duration-500`}>
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Bug Probability Score</h3>
          <div className="flex items-baseline space-x-1">
            <span className={`text-6xl font-bold tracking-tighter ${result > 50 ? 'text-red-400' : result > 20 ? 'text-yellow-400' : 'text-green-400'}`}>
              {result}%
            </span>
          </div>
          <p className="mt-4 text-gray-300">
            {result > 50 
              ? "High risk detected. The cyclomatic complexity is likely too high." 
              : result > 20 
              ? "Moderate risk. Consider refactoring for better readability." 
              : "Code looks solid and manageable."}
          </p>
        </div>
      )}

    </div>
  );
}
