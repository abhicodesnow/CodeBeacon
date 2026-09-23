'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import UserWidget from '../../components/UserWidget';
import { saveSnippetAnalysis, getSnippetHistory } from './actions';
import { createClient } from '../../utils/supabase/client';

const COMPILERS = {
  cpp: ["GNU G++ 14.1 (C++23)", "GNU G++ 11.4 (C++17)", "Clang 18.1"],
  py: ["Python 3.12.3", "Python 3.11.9", "Python 3.10.14"],
  java: ["Java 21 (LTS)", "Java 17 (LTS)", "Java 11 (LTS)"],
  js: ["Node.js 22.x", "Node.js 20.x (LTS)"],
  rs: ["Rust 1.78.0", "Rust 1.75.0"],
};

const LANGUAGE_NAMES = {
  cpp: "C++",
  py: "Python",
  java: "Java",
  js: "JavaScript",
  rs: "Rust"
};

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
  
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [vimMode, setVimMode] = useState(false);
  const [vimState, setVimState] = useState<'NORMAL' | 'INSERT'>('INSERT');
  const editorRef = useRef<any>(null);
  
  const [mouse, setMouse] = useState({ offsetX: 0, offsetY: 0, clientX: -1000, clientY: -1000 });

  // Database & Session State
  const [history, setHistory] = useState<any[]>([]);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const supabase = createClient();

  // Initial Data Fetch & Auth Listener
  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSessionUser(session.user);
        const dbHistory = await getSnippetHistory();
        setHistory(dbHistory);
      }
    };
    initData();

    // Listen for auth events (login/logout) to refresh sidebar automatically
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSessionUser(session.user);
        const dbHistory = await getSnippetHistory();
        setHistory(dbHistory);
      } else {
        setSessionUser(null);
        setHistory([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  // Native robust Vim mode state toggler using Monaco keybindings
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    if (vimMode) {
      setVimState('NORMAL');
      editor.updateOptions({ cursorStyle: 'block' });
    } else {
      setVimState('INSERT');
      editor.updateOptions({ cursorStyle: 'line' });
    }
  }, [vimMode]);

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

      const responseData = await response.json();
      const riskScore = responseData.data.bug_probability;
      setResult(riskScore);

      // Save to Database if logged in
      if (sessionUser) {
        await saveSnippetAnalysis({
          title,
          code,
          language,
          bugProbability: riskScore
        });
        
        // Refresh the sidebar history to show the new scan
        const updatedHistory = await getSnippetHistory();
        setHistory(updatedHistory);
      }

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

  const handleEditorWillMount = (monaco: any) => {
    monaco.editor.defineTheme('vscode-dark-plus', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569cd6' },
        { token: 'identifier', foreground: '9cdcfe' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'class', foreground: '4ec9b0' },
        { token: 'interface', foreground: '4ec9b0' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'comment', foreground: '6a9955' },
        { token: 'constant', foreground: '4fc1ff' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'delimiter', foreground: 'd4d4d4' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editorCursor.foreground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editor.lineHighlightBackground': '#1c1f24',
      },
    });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    setEditorTheme('vscode-dark-plus');
    editorRef.current = editor;

    // Intercept keystrokes when Vim mode is enabled natively
    editor.onKeyDown((e: any) => {
      if (!vimMode) return;

      // Pressing 'i' in Normal mode switches to Insert mode
      if (vimState === 'NORMAL' && e.browserEvent.key === 'i') {
        e.preventDefault();
        setVimState('INSERT');
        editor.updateOptions({ cursorStyle: 'line' });
      } 
      // Pressing 'Escape' in Insert mode switches back to Normal mode
      else if (vimState === 'INSERT' && e.browserEvent.key === 'Escape') {
        e.preventDefault();
        setVimState('NORMAL');
        editor.updateOptions({ cursorStyle: 'block' });
      }
    });
  };

  return (
    <div 
      className="flex h-screen w-full bg-black text-gray-200 font-sans overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
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
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {history.length === 0 ? (
              <div className="text-gray-500 space-y-3 p-4 text-center mt-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm">No recent scans.<br/>Your history will appear here.</p>
              </div>
            ) : (
              <div className="w-full flex flex-col space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="p-4 bg-[#111] border border-gray-800/60 rounded-xl hover:bg-[#1a1a1a] cursor-pointer transition-colors text-left flex flex-col group">
                    <h4 className="text-sm font-semibold text-gray-200 truncate group-hover:text-blue-400 transition-colors">{item.title}</h4>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-800/50 px-2 py-1 rounded">{item.language}</span>
                      <span className={`text-[11px] font-bold ${item.bugProbability > 50 ? 'text-red-400' : item.bugProbability > 20 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {item.bugProbability}% Risk
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-all duration-300">
        
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
            <UserWidget vimMode={vimMode} setVimMode={setVimMode} />
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto">
          
          <div className={`w-full flex flex-col relative transition-all duration-300 ${isFullscreen ? 'z-[100]' : 'z-10'}`}>
            
            <div className="absolute inset-0 bg-[#0d0d0d]/80 backdrop-blur-xl border border-gray-800/80 rounded-2xl shadow-2xl pointer-events-none -z-10"></div>

            <div className="flex items-center justify-between bg-black/50 px-6 py-4 border-b border-gray-800/60 rounded-t-2xl">
              <div className="flex items-center space-x-4">
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

            <div className="p-6 relative flex flex-col flex-1">
              
              {isFullscreen && <div className="h-[400px] w-full pointer-events-none"></div>}

              <div 
                className={`flex flex-col origin-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                  isFullscreen 
                    ? 'fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md p-6 sm:p-10 animate-in zoom-in-75' 
                    : 'relative w-full z-20 bg-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-4 w-full">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Snippet Title (e.g., Dijkstra's Algorithm Optimization)..."
                    className="flex-1 bg-transparent text-xl font-bold text-white placeholder-gray-600 focus:outline-none border-b border-gray-800 focus:border-blue-500 pb-3 transition-colors mr-6"
                  />
                  
                  <button 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className={`flex-shrink-0 p-2.5 bg-[#141414] hover:bg-[#1f1f1f] text-gray-400 hover:text-white rounded-lg border border-gray-800 transition-transform duration-700 hover:scale-110 focus:outline-none focus:ring-1 focus:ring-gray-600`}
                    title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
                  >
                    {isFullscreen ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="14" y1="10" x2="21" y2="3" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className={`relative w-full transition-all duration-700 ${
                  isFullscreen ? 'flex-1 rounded-xl overflow-hidden border border-gray-700/60 shadow-2xl' : 'h-[350px] rounded-lg overflow-hidden border border-gray-800/50'
                }`}>
                  <Editor
                    height="100%"
                    language={MONACO_LANGUAGES[language]}
                    theme={editorTheme} 
                    value={code}
                    onChange={(value: string | undefined) => setCode(value || '')}
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 15,
                      fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                      fontLigatures: true,
                      padding: { top: 20 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                      formatOnPaste: true,
                      automaticLayout: true,
                    }}
                    loading={
                      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        Initializing Editor...
                      </div>
                    }
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-5 flex justify-between items-center bg-black/30 border-t border-gray-800/60 relative z-10 rounded-b-2xl">
              <div className="flex-1 flex items-center space-x-3">
                {!title.trim() && (
                  <span className="text-xs text-yellow-500/80 font-medium tracking-wide flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Title required for analysis
                  </span>
                )}
                
                {vimMode && (
                  <div className="font-mono text-[10px] font-bold text-blue-400 tracking-widest ml-4 bg-blue-900/20 px-2 py-1 rounded">
                    --{vimState}--
                  </div>
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