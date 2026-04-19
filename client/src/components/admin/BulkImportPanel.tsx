import { useState, useRef } from 'react';
import { FiUpload, FiDownload, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import api from '../../lib/axios';

interface ImportResult {
  success_count: number;
  error_count: number;
  errors: Array<{ row: number | string; reason: string }>;
}

interface Props {
  onComplete: () => void;
  testId?: string;
}

export default function BulkImportPanel({ onComplete, testId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(ext || '')) {
      setError('Only .csv and .json files are supported');
      return;
    }

    setFile(selected);
    setError('');
    setResult(null);
  }

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (testId) {
        formData.append('test_id', testId);
      }

      const { data } = await api.post('/questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(data);
      
      if (data.success_count > 0) {
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate(format: 'csv' | 'json') {
    const templates = {
      csv: `type,statement,option_1,option_2,option_3,option_4,correct_options,marks,topic_tag,difficulty
mcq_single,"What is the capital of France?",Paris,London,Berlin,Madrid,0,2,Geography,easy
mcq_multi,"Which are programming languages?",Python,HTML,JavaScript,CSS,"0,2",3,Programming,medium
debugging,"Fix the syntax error",,,,,0,5,Python,medium`,
      json: JSON.stringify([
        {
          type: 'mcq_single',
          statement: 'What is the capital of France?',
          options: [
            { text: 'Paris', is_correct: true },
            { text: 'London', is_correct: false },
            { text: 'Berlin', is_correct: false },
            { text: 'Madrid', is_correct: false }
          ],
          marks: 2,
          topic_tag: 'Geography',
          difficulty: 'easy'
        },
        {
          type: 'mcq_multi',
          statement: 'Which are programming languages?',
          options: [
            { text: 'Python', is_correct: true },
            { text: 'HTML', is_correct: false },
            { text: 'JavaScript', is_correct: true },
            { text: 'CSS', is_correct: false }
          ],
          marks: 3,
          topic_tag: 'Programming',
          difficulty: 'medium'
        },
        {
          type: 'debugging',
          statement: 'Fix the syntax error in this code',
          correct_code: 'print("Hello World")',
          language: 'python',
          marks: 5,
          topic_tag: 'Python',
          difficulty: 'medium',
          bug_count: 1
        }
      ], null, 2)
    };

    const blob = new Blob([templates[format]], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question_template.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto custom-scrollbar p-8">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          {/* Upload Area */}
          <div 
            className="glass-2 p-12 text-center relative overflow-hidden border-2 border-dashed border-white/10 hover:border-accent/40 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <FiUpload className="mx-auto text-5xl mb-6 text-accent opacity-40 hover:scale-110 transition-transform" />
            
            {file ? (
              <>
                <h2 className="text-2xl font-black text-primary tracking-tighter uppercase mb-2">
                  {file.name}
                </h2>
                <p className="text-[10px] font-black text-secondary tracking-[0.4em] uppercase opacity-30 mb-6">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">Drop Core</h2>
                <p className="text-[10px] font-black text-secondary tracking-[0.4em] uppercase opacity-30 mt-2 mb-6">
                  Select JSON / CSV Bundle
                </p>
              </>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-6 py-3 rounded-xl bg-accent/10 text-accent font-black text-xs uppercase tracking-widest hover:bg-accent/20 transition-all"
            >
              Browse Files
            </button>
          </div>

          {/* Template Downloads */}
          <div className="glass-2 p-6">
            <p className="text-[10px] font-black text-secondary tracking-[0.3em] uppercase opacity-40 mb-4">
              Download Templates
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => downloadTemplate('csv')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black/20 text-primary font-bold text-xs uppercase tracking-widest hover:bg-black/30 transition-all"
              >
                <FiDownload />
                CSV Template
              </button>
              <button
                onClick={() => downloadTemplate('json')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black/20 text-primary font-bold text-xs uppercase tracking-widest hover:bg-black/30 transition-all"
              >
                <FiDownload />
                JSON Template
              </button>
            </div>
          </div>

          {/* Upload Button */}
          {file && !result && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-4 rounded-xl bg-accent text-white font-black text-sm uppercase tracking-[0.2em] hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FiUpload />
                  Import Questions
                </>
              )}
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="glass-2 p-6 border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-3 mb-2">
                <FiX className="text-red-400 text-xl" />
                <p className="text-sm font-black text-red-400 uppercase tracking-widest">Import Failed</p>
              </div>
              <p className="text-xs text-red-400/80">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Success Summary */}
              <div className={`glass-2 p-6 ${result.success_count > 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <div className="flex items-center gap-3 mb-4">
                  {result.success_count > 0 ? (
                    <FiCheck className="text-green-400 text-2xl" />
                  ) : (
                    <FiX className="text-red-400 text-2xl" />
                  )}
                  <div>
                    <p className="text-lg font-black text-primary uppercase tracking-tight">
                      {result.success_count} Questions Imported
                    </p>
                    <p className="text-[10px] font-black text-secondary tracking-[0.3em] uppercase opacity-40">
                      {result.error_count} errors encountered
                    </p>
                  </div>
                </div>

                {result.success_count > 0 && (
                  <p className="text-xs text-green-400/80">
                    Redirecting to question list...
                  </p>
                )}
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="glass-2 p-6 border-yellow-500/20 bg-yellow-500/5 max-h-64 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center gap-3 mb-4">
                    <FiAlertTriangle className="text-yellow-400 text-xl" />
                    <p className="text-sm font-black text-yellow-400 uppercase tracking-widest">
                      {result.errors.length} Validation Errors
                    </p>
                  </div>
                  <div className="space-y-2">
                    {result.errors.map((err, i) => (
                      <div key={i} className="p-3 rounded-lg bg-black/20 border border-white/5">
                        <p className="text-xs font-mono text-primary">
                          <span className="text-yellow-400 font-bold">Row {err.row}:</span> {err.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError('');
                }}
                className="w-full py-3 rounded-xl bg-black/20 text-secondary font-bold text-xs uppercase tracking-widest hover:bg-black/30 transition-all"
              >
                Import Another File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
