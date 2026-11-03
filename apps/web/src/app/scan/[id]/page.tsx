import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSnippetById } from '../../actions';

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  py: 'Python',
  java: 'Java',
  js: 'JavaScript',
  rs: 'Rust',
};

export default async function SharedScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scan = await getSnippetById(id);

  if (!scan) {
    notFound();
  }

  const risk = scan.bugProbability;

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
              CodeBeacon Shared Forensic Snapshot
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-1">{scan.title}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Language: {LANGUAGE_LABELS[scan.language] || scan.language.toUpperCase()} • Scanned on{' '}
              {new Date(scan.createdAt).toLocaleString()}
            </p>
          </div>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            Open in CodeBeacon IDE →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            className={`p-5 rounded-xl border text-center ${
              risk > 50
                ? 'border-red-900/50 bg-red-900/10'
                : risk > 20
                ? 'border-yellow-900/50 bg-yellow-900/10'
                : 'border-green-900/50 bg-green-900/10'
            }`}
          >
            <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">
              Bug Probability
            </h3>
            <span
              className={`text-4xl font-black tracking-tight ${
                risk > 50 ? 'text-red-500' : risk > 20 ? 'text-yellow-500' : 'text-green-500'
              }`}
            >
              {risk}%
            </span>
          </div>

          <div className="p-5 rounded-xl border border-gray-800 bg-[#0d0d0d] text-center">
            <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">
              Maintainability
            </h3>
            <span className="text-4xl font-black tracking-tight text-blue-400">
              {scan.maintainabilityIndex ?? 'N/A'}
            </span>
          </div>

          <div className="p-5 rounded-xl border border-gray-800 bg-[#0d0d0d] text-center">
            <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">
              Cyclomatic Complexity
            </h3>
            <span className="text-4xl font-black tracking-tight text-purple-400">
              {scan.cyclomaticComplexity ?? 'N/A'}
            </span>
          </div>

          <div className="p-5 rounded-xl border border-gray-800 bg-[#0d0d0d] text-center">
            <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-1">
              Estimated Big-O
            </h3>
            <span className="text-2xl font-black tracking-tight text-emerald-400 block mt-1">
              {scan.timeComplexity ?? 'O(N)'}
            </span>
            <p className="text-xs text-gray-500 mt-1">Space: {scan.spaceComplexity ?? 'O(1)'}</p>
          </div>
        </div>

        {scan.warnings && scan.warnings.length > 0 && (
          <div className="border border-gray-800 bg-[#0d0d0d] rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Static & AST Forensics
            </h3>
            <ul className="space-y-2">
              {scan.warnings.map((w, idx) => (
                <li
                  key={idx}
                  className="text-sm text-gray-300 flex items-start space-x-2 bg-black/50 px-3.5 py-2.5 rounded-lg border border-gray-800/60"
                >
                  <span className="text-blue-400 font-bold">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {scan.aiReview && (
          <div className="border border-purple-800/40 bg-purple-950/15 rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              Llama 3 Diagnostic Review
            </h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{scan.aiReview}</p>
          </div>
        )}

        <div className="border border-gray-800 bg-[#0a0a0a] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[#121212] border-b border-gray-800 text-xs font-mono text-gray-400">
            Source Code Snapshot
          </div>
          <pre className="p-5 text-xs font-mono text-gray-200 overflow-x-auto leading-relaxed">
            {scan.code.split('\n').map((line, i) => (
              <div key={i} className="table-row">
                <span className="table-cell pr-4 text-gray-600 select-none text-right">
                  {i + 1}
                </span>
                <span className="table-cell whitespace-pre">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}