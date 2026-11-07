import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Edit3, Save, X } from 'lucide-react';

interface CodeBlockProps {
  title: string;
  subtitle?: string;
  code: string;
  filename?: string;
  variant?: 'default' | 'warning';
  editable?: boolean;
  onCopySuccess?: (msg: string) => void;
  onSaveCode?: (newCode: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  title,
  subtitle,
  code,
  filename,
  variant = 'default',
  editable = false,
  onCopySuccess,
  onSaveCode,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState(code);

  // Sync edit buffer if code changes externally
  useEffect(() => {
    setEditCode(code);
  }, [code]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editCode : code;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      onCopySuccess?.(`Script "${title}" copiado para a área de transferência.`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
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
    const textToDownload = isEditing ? editCode : code;
    const blob = new Blob([textToDownload], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'script_oracle_18xe.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    onSaveCode?.(editCode);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditCode(code);
    setIsEditing(false);
  };

  const lines = (isEditing ? editCode : code).split('\n');

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
            {isEditing && (
              <span className="ml-1 text-[10px] font-semibold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded">
                Editando Script
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editable && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 rounded-md transition-colors whitespace-nowrap shrink-0"
              title="Editar conteúdo deste script SQL"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Script</span>
            </button>
          )}

          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Script</span>
              </button>
            </>
          )}

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

      {isEditing ? (
        <div className="p-3 bg-slate-950/80 border-t border-slate-800/50 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Você pode alterar comandos, nomes de tabelas, inserts e comentários diretamente aqui.</span>
            <span className="font-mono text-emerald-400 text-[11px]">SQL Editável</span>
          </div>
          <textarea
            rows={Math.max(8, Math.min(22, editCode.split('\n').length + 2))}
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            className="w-full bg-[#080C14] border border-slate-700 rounded-md p-3.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-rose-500 leading-relaxed custom-scroll"
            placeholder="Digite ou cole aqui o script SQL..."
            spellCheck={false}
          />
        </div>
      ) : (
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
      )}
    </div>
  );
};
