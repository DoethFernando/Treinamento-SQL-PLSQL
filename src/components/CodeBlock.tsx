import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';

interface CodeBlockProps {
  title: string;
  subtitle?: string;
  code: string;
  filename?: string;
  variant?: 'default' | 'warning';
  onCopySuccess?: (msg: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  title,
  subtitle,
  code,
  filename,
  variant = 'default',
  onCopySuccess,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopySuccess?.(`Script "${title}" copiado para a área de transferência.`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      onCopySuccess?.(`Script "${title}" copiado para a área de transferência.`);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'script_oracle_18xe.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lines = code.split('\n');

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0D1322] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/90 bg-slate-900/70">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <span className={variant === 'warning' ? 'text-amber-300 font-semibold' : 'text-slate-200 font-semibold'}>
              {title}
            </span>
            {subtitle && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400 truncate">{subtitle}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {filename && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Baixar arquivo .sql"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .sql</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar Script</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto custom-scroll p-4">
        <pre className="text-[13px] leading-relaxed font-mono">
          <code>
            {lines.map((line, idx) => {
              const trimmed = line.trimStart();
              const isComment = trimmed.startsWith('--');
              return (
                <div key={idx} className="table-row">
                  <span className="table-cell pr-4 text-right select-none text-slate-600 tabular-nums text-xs w-8">
                    {idx + 1}
                  </span>
                  <span
                    className={`table-cell whitespace-pre ${
                      isComment
                        ? 'text-slate-400 italic'
                        : variant === 'warning'
                        ? 'text-amber-200'
                        : 'text-emerald-300'
                    }`}
                  >
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
};
