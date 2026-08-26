import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileImage,
  FileJson,
  Fingerprint,
  HardDrive,
  ImagePlus,
  Info,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Type,
  UploadCloud,
  X,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type FindingLevel = 'clear' | 'review';
type Report = {
  fileName: string;
  size: string;
  dimensions: string;
  format: string;
  analyzedAt: string;
  source: 'uploaded' | 'sample';
  level: FindingLevel;
  score: number;
  summary: string;
  qr: { type: string; payload: string; confidence: string }[];
  text: string;
  signals: { label: string; detail: string; level: FindingLevel }[];
};

type BrowserBarcode = { rawValue?: string; format?: string };
type BrowserBarcodeDetector = new () => { detect: (source: CanvasImageSource) => Promise<BrowserBarcode[]> };

const sampleReport: Report = {
  fileName: 'message-from-vendor.png',
  size: '182 KB',
  dimensions: '1200 × 900 px',
  format: 'PNG image',
  analyzedAt: 'Today, 14:32:08 UTC',
  source: 'sample',
  level: 'review',
  score: 61,
  summary: 'A QR payload was found. The destination uses a URL shortener, so verify the final destination before opening it.',
  qr: [{ type: 'QR Code', payload: 'https://t.ly/4mQ7a', confidence: '98.4%' }],
  text: 'URGENT: Review the attached invoice\nVendor Services · INV-2048\nScan to view secure document',
  signals: [
    { label: 'Shortened destination', detail: 't.ly obscures the final host', level: 'review' },
    { label: 'Action language', detail: '“URGENT” creates time pressure', level: 'review' },
    { label: 'Image integrity', detail: 'No embedded script or macro detected', level: 'clear' },
  ],
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageDimensions(file: File) {
  return new Promise<string>((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      resolve(`${image.naturalWidth} × ${image.naturalHeight} px`);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve('Dimensions unavailable');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

async function detectLocalCodes(file: File) {
  const Detector = (window as unknown as { BarcodeDetector?: BrowserBarcodeDetector }).BarcodeDetector;
  if (!Detector) return [];
  try {
    const image = new Image();
    const url = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image could not be decoded'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')?.drawImage(image, 0, 0);
    const codes = await new Detector().detect(canvas);
    URL.revokeObjectURL(url);
    return codes.filter((code) => code.rawValue).map((code) => ({
      type: code.format === 'qr_code' ? 'QR Code' : (code.format || 'Barcode').replace('_', ' '),
      payload: code.rawValue as string,
      confidence: 'Browser detected',
    }));
  } catch {
    return [];
  }
}

function FauxQr() {
  return (
    <div className="relative h-28 w-28 overflow-hidden rounded-lg border-4 border-[#f7f7f0] bg-[#f7f7f0] shadow-[0_5px_16px_rgba(31,53,58,.16)]" aria-label="Sample QR code">
      <div className="absolute inset-2 opacity-90" style={{ backgroundImage: 'repeating-conic-gradient(#1f353a 0 25%, #f7f7f0 0 50%)', backgroundSize: '12px 12px' }} />
      <div className="absolute left-2 top-2 h-6 w-6 border-4 border-[#1f353a] bg-[#f7f7f0] shadow-[inset_0_0_0_3px_#1f353a]" />
      <div className="absolute bottom-2 right-2 h-6 w-6 border-4 border-[#1f353a] bg-[#f7f7f0] shadow-[inset_0_0_0_3px_#1f353a]" />
    </div>
  );
}

function Rail({ onReset }: { onReset: () => void }) {
  return (
    <aside className="side-rail">
      <div className="flex items-center gap-3 px-2">
        <div className="brand-mark" aria-hidden="true"><ScanLine size={17} strokeWidth={1.6} /></div>
        <div>
          <div className="mono text-[10px] font-medium tracking-[.16em] text-[#dce3d3]">SIGNAL</div>
          <div className="text-[10px] tracking-[.14em] text-[#92a69b]">EVIDENCE DESK</div>
        </div>
      </div>
      <div className="mt-12">
        <div className="eyebrow px-3 text-[#8fa49a]">Workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Workspace navigation">
          <button className="rail-link active flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm" data-testid="button-nav-inspect" onClick={onReset}>
            <ScanLine size={16} /> <span>Inspect image</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e4a85e] pulse-dot" />
          </button>
          <button className="rail-link flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm" data-testid="button-nav-archive" onClick={() => window.alert('Local archive is intentionally empty. Export reports to retain evidence.')}>
            <Archive size={16} /> <span>Local archive</span>
          </button>
        </nav>
      </div>
      <div className="mt-auto rounded-xl border border-[#dce3d3]/15 bg-[#dce3d3]/5 p-3.5">
        <div className="flex items-center gap-2 text-[#dce3d3]">
          <ShieldCheck size={15} />
          <span className="mono text-[10px] tracking-[.12em]">LOCAL PROCESSING</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#9aada3]">Files stay in this browser. No image is sent to a server.</p>
      </div>
      <div className="mt-5 px-3">
        <div className="mono text-[10px] text-[#718a80]">BUILD 0.8.4 · OFFLINE READY</div>
      </div>
    </aside>
  );
}

function Topbar({ hasReport, onReset }: { hasReport: boolean; onReset: () => void }) {
  return (
    <header className="topbar">
      <div className="mobile-brand items-center gap-2">
        <div className="brand-mark" aria-hidden="true"><ScanLine size={16} /></div>
        <span className="mono text-[10px] font-medium tracking-[.15em]">SIGNAL / INSPECT</span>
      </div>
      <div className="topbar-meta flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#438b7d] pulse-dot" />
          <span className="mono text-[10px] tracking-[.12em] text-muted-foreground">BROWSER RUNTIME READY</span>
        </div>
        <span className="h-4 w-px bg-border" />
        <span className="mono text-[10px] text-muted-foreground">CASE / UNASSIGNED</span>
      </div>
      <button onClick={onReset} className="button-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold" data-testid="button-clear-desk">
        <RefreshCw size={14} /> <span>{hasReport ? 'Clear desk' : 'New inspection'}</span>
      </button>
    </header>
  );
}

function FileDrop({ onFile, onDemo, dragging, setDragging }: { onFile: (file: File) => void; onDemo: () => void; dragging: boolean; setDragging: (value: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <div
        className={`drop-zone rounded-xl p-5 text-center ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        data-testid="dropzone-image"
      >
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--primary)/.11)] text-primary">
          <UploadCloud size={21} strokeWidth={1.6} />
        </div>
        <p className="mt-3 text-sm font-bold">Drop an image here</p>
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP or GIF · up to 15 MB</p>
        <button className="button-primary mt-4 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold" onClick={() => inputRef.current?.click()} data-testid="button-choose-image">
          <ImagePlus size={15} /> Choose image
        </button>
        <input ref={inputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = '';
        }} data-testid="input-image-file" />
      </div>
      <button onClick={onDemo} className="button-secondary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold" data-testid="button-run-sample">
        <Sparkles size={14} className="text-[#b17539]" /> Run a sample inspection
      </button>
      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">Sample data is synthetic and clearly marked in the report.</p>
    </div>
  );
}

function MetaList({ report }: { report: Report }) {
  const values = [
    ['Source', report.source === 'sample' ? 'Synthetic sample' : 'Local upload'],
    ['File type', report.format],
    ['File size', report.size],
    ['Dimensions', report.dimensions],
    ['Analyzed', report.analyzedAt],
  ];
  return (
    <div className="space-y-0.5">
      {values.map(([label, value]) => (
        <div className="flex items-center justify-between gap-3 py-2 text-xs" key={label}>
          <span className="text-muted-foreground">{label}</span>
          <span className={`mono text-right text-[10px] ${label === 'Source' && report.source === 'sample' ? 'text-[#a4662b]' : ''}`} data-testid={`text-meta-${label.toLowerCase().replace(' ', '-')}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ScanningState({ fileName, progress }: { fileName: string; progress: number }) {
  return (
    <div className="soft-card paper-grid flex min-h-[520px] flex-col items-center justify-center p-8 text-center reveal">
      <div className="scan-orbit"><div className="scan-core" /></div>
      <div className="eyebrow mt-8 text-primary">Working locally</div>
      <h2 className="mt-3 text-2xl font-extrabold tracking-[-.04em]">Reading the evidence</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Checking the image container, looking for machine-readable payloads, and preparing a clear report.</p>
      <div className="mt-8 w-full max-w-sm">
        <div className="mb-2 flex justify-between mono text-[10px] text-muted-foreground"><span>{fileName}</span><span data-testid="text-scan-progress">{progress}%</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" /> Nothing leaves this tab</div>
    </div>
  );
}

function EmptyReport() {
  return (
    <div className="soft-card paper-grid flex min-h-[520px] flex-col justify-between overflow-hidden p-7 reveal reveal-delay-1">
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow text-primary">Inspection canvas</div>
          <h2 className="mt-3 max-w-md text-3xl font-extrabold leading-[1.05] tracking-[-.05em]">Start with a piece of evidence.</h2>
        </div>
        <div className="hidden rounded-full border border-border px-2.5 py-1 mono text-[9px] text-muted-foreground sm:block">NO CASE OPEN</div>
      </div>
      <div className="relative flex items-center justify-center py-9">
        <div className="absolute h-64 w-64 rounded-full border border-primary/10" />
        <div className="absolute h-44 w-44 rounded-full border border-primary/15" />
        <div className="relative rounded-2xl border border-border bg-card p-5 shadow-[0_15px_35px_rgba(31,53,58,.08)]">
          <FauxQr />
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#438b7d]" />
            <span className="mono text-[9px] tracking-[.12em] text-muted-foreground">AWAITING INPUT</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
        {[['01', 'Inspect', 'Preview and verify the image file.'], ['02', 'Decode', 'Surface QR or barcode payloads.'], ['03', 'Explain', 'See why a signal needs attention.']].map(([number, title, body]) => (
          <div key={number} className="flex gap-3">
            <span className="mono text-[10px] text-primary">{number}</span>
            <div><div className="text-xs font-bold">{title}</div><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{body}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: FindingLevel }) {
  return level === 'clear'
    ? <span className="status-clean inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"><CheckCircle2 size={12} /> Clear</span>
    : <span className="status-attention inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"><AlertTriangle size={12} /> Review</span>;
}

function ReportView({ report, onExport, onCopy }: { report: Report; onExport: () => void; onCopy: () => void }) {
  return (
    <div className="space-y-4">
      <section className={`soft-card reveal overflow-hidden border-l-4 ${report.level === 'clear' ? 'border-l-primary' : 'border-l-[#bb6a4d]'}`}>
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl ${report.level === 'clear' ? 'status-clean' : 'status-attention'}`}>
              {report.level === 'clear' ? <ShieldCheck size={23} strokeWidth={1.7} /> : <AlertTriangle size={23} strokeWidth={1.7} />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={report.level} />
                {report.source === 'sample' && <span className="rounded-full bg-[#e9ddc8] px-2 py-1 text-[10px] font-bold text-[#8f5a26]">SAMPLE DATA</span>}
              </div>
              <h2 className="mt-2 text-xl font-extrabold tracking-[-.04em]" data-testid="text-risk-summary">{report.level === 'clear' ? 'No immediate risk signals' : 'One payload deserves a closer look'}</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:pl-4">
            <div className="text-center">
              <div className="metric-number text-primary" data-testid="text-risk-score">{report.score}</div>
              <div className="mono mt-1 text-[9px] tracking-[.08em] text-muted-foreground">RISK INDEX</div>
            </div>
            <div className="h-12 w-px bg-border" />
            <button onClick={onExport} className="button-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold" data-testid="button-export-report"><Download size={15} /> Export JSON</button>
          </div>
        </div>
      </section>

      <div className="report-grid grid grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)] gap-4">
        <div className="space-y-4">
          <section className="soft-card reveal reveal-delay-1 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5"><ScanLine size={16} className="text-primary" /><h3 className="text-sm font-extrabold">QR & barcode findings</h3></div>
              <span className="mono text-[10px] text-muted-foreground">{report.qr.length} detected</span>
            </div>
            {report.qr.length ? report.qr.map((item, index) => (
              <div key={`${item.payload}-${index}`} className="finding-row p-5" data-testid={`finding-qr-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><span className="rounded bg-secondary px-2 py-1 mono text-[10px]">{item.type}</span><span className="text-[11px] text-muted-foreground">Confidence {item.confidence}</span></div>
                  <button onClick={() => navigator.clipboard?.writeText(item.payload)} className="button-secondary inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold" data-testid={`button-copy-payload-${index}`}><Clipboard size={12} /> Copy</button>
                </div>
                <div className="mt-4 break-all rounded-lg bg-[#20343a] px-4 py-3 mono text-xs text-[#e8d9bd]" data-testid={`text-payload-${index}`}>{item.payload}</div>
                {report.level === 'review' && <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[#a4662b]"><Info size={14} className="mt-0.5 shrink-0" /> Short URLs hide the final destination. Resolve in an isolated environment before visiting.</div>}
              </div>
            )) : (
              <div className="p-7 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground"><ScanLine size={18} /></div><p className="mt-3 text-sm font-bold">No QR or barcode detected</p><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">This browser-only pass did not identify a machine-readable payload. A negative result is not proof that one is absent.</p></div>
            )}
          </section>
          <section className="soft-card reveal reveal-delay-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2.5"><Type size={16} className="text-primary" /><h3 className="text-sm font-extrabold">Visible text</h3></div><span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">{report.text ? 'Captured' : 'Not available'}</span></div>
            <div className="p-5"><div className="min-h-[90px] whitespace-pre-line rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground" data-testid="text-extracted-content">{report.text || 'No text extraction was run for this image.'}</div><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground"><Info size={12} className="mr-1 inline-block align-[-2px]" /> Text is a visual aid, not a claim of document authenticity.</p></div>
          </section>
        </div>
        <div className="space-y-4">
          <section className="soft-card reveal reveal-delay-1 overflow-hidden">
            <div className="border-b border-border px-5 py-4"><div className="flex items-center gap-2.5"><Fingerprint size={16} className="text-primary" /><h3 className="text-sm font-extrabold">Explainable signals</h3></div><p className="mt-1 text-[11px] text-muted-foreground">What shaped this assessment</p></div>
            <div className="px-5">
              {report.signals.map((signal, index) => <div className="finding-row flex gap-3 py-4" key={signal.label} data-testid={`signal-${index}`}><div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ${signal.level === 'clear' ? 'status-clean' : 'status-attention'}`}>{signal.level === 'clear' ? <Check size={14} /> : <AlertTriangle size={14} />}</div><div><div className="text-xs font-bold">{signal.label}</div><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{signal.detail}</p></div></div>)}
            </div>
          </section>
          <section className="soft-card reveal reveal-delay-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2.5"><HardDrive size={16} className="text-primary" /><h3 className="text-sm font-extrabold">File metadata</h3></div><FileImage size={15} className="text-muted-foreground" /></div>
            <div className="px-5 py-2"><MetaList report={report} /></div>
          </section>
          <button onClick={onCopy} className="button-secondary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-bold reveal reveal-delay-3" data-testid="button-copy-report"><Clipboard size={15} /> Copy report to clipboard</button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-1 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck size={13} className="text-primary" /> This report describes observable signals in the image. It does not determine intent or guarantee safety.</div>
    </div>
  );
}

function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setReport(null);
    setPreviewUrl(null);
    setFile(null);
    setError('');
    setProgress(0);
    setIsScanning(false);
  };

  const makeReport = async (nextFile: File) => {
    setError('');
    if (!nextFile.type.startsWith('image/')) {
      setError('That file is not an image. Choose a PNG, JPG, WEBP, or GIF.');
      return;
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      setError('This image is larger than 15 MB. Choose a smaller file to keep processing local and responsive.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreviewUrl(nextUrl);
    setReport(null);
    setIsScanning(true);
    setProgress(12);
    const [dimensions, localCodes] = await Promise.all([getImageDimensions(nextFile), detectLocalCodes(nextFile)]);
    let current = 12;
    const timer = window.setInterval(() => {
      current = Math.min(current + 17, 95);
      setProgress(current);
    }, 240);
    window.setTimeout(() => {
      window.clearInterval(timer);
      setProgress(100);
      window.setTimeout(() => {
        setIsScanning(false);
        const hasCode = localCodes.length > 0;
        const hasShortUrl = localCodes.some((code) => /t\.ly|bit\.ly|tinyurl|shorturl/i.test(code.payload));
        setReport({
          fileName: nextFile.name,
          size: formatBytes(nextFile.size),
          dimensions,
          format: `${nextFile.type.replace('image/', '').toUpperCase()} image`,
          analyzedAt: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }),
          source: 'uploaded',
          level: hasShortUrl ? 'review' : 'clear',
          score: hasShortUrl ? 55 : hasCode ? 22 : 8,
          summary: hasShortUrl
            ? 'A machine-readable payload was found. The destination uses a URL shortener, so verify the final destination before opening it.'
            : hasCode
              ? 'A machine-readable payload was found locally. Review its destination or content before taking action.'
              : 'No QR or barcode payload was surfaced in this browser-only pass. No immediate risk signal is present in the observable file data.',
          qr: localCodes,
          text: '',
          signals: [
            { label: 'Machine-readable payload', detail: hasCode ? 'Detected by the browser Barcode Detection API' : 'No QR or barcode detected by the available local scan path', level: hasCode ? 'review' : 'clear' },
            ...(hasShortUrl ? [{ label: 'Shortened destination', detail: 'The final host is obscured behind a URL shortener', level: 'review' as FindingLevel }] : []),
            { label: 'Image integrity', detail: 'Image loaded and rendered without a browser decoding error', level: 'clear' },
            { label: 'Network activity', detail: 'No upload or remote lookup performed', level: 'clear' },
          ],
        });
      }, 260);
    }, 1450);
  };

  const runSample = () => {
    setError('');
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsScanning(true);
    setProgress(0);
    let current = 0;
    const timer = window.setInterval(() => {
      current += 20;
      setProgress(current);
      if (current >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => { setIsScanning(false); setReport(sampleReport); }, 240);
      }
    }, 180);
  };

  const reportJson = useMemo(() => report ? JSON.stringify({ ...report, generatedBy: 'Signal Evidence Desk', privacy: 'Processed locally in browser; no image upload performed.' }, null, 2) : '', [report]);
  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.fileName.replace(/\.[^/.]+$/, '') || 'evidence-report'}-forensics.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copyReport = async () => {
    if (!report) return;
    await navigator.clipboard?.writeText(reportJson);
    setError('Report copied to clipboard.');
    window.setTimeout(() => setError(''), 2200);
  };

  return (
    <div className="noise app-shell">
      <Rail onReset={reset} />
      <div className="workspace">
        <Topbar hasReport={Boolean(report || isScanning)} onReset={reset} />
        <main className="content-wrap">
          <section className="mb-8 flex flex-col justify-between gap-6 border-b border-border pb-8 lg:flex-row lg:items-end">
            <div className="reveal">
              <div className="eyebrow flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[#438b7d]" /> Private inspection workspace</div>
              <h1 className="display-title mt-4">Make the image<br /><span className="text-primary">answerable.</span></h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">Decode suspicious QR and barcode payloads, make visible text legible, and leave with a report your team can verify.</p>
            </div>
            <div className="reveal reveal-delay-1 max-w-xs lg:pb-1"><div className="flex items-start gap-3"><div className="mt-0.5 text-primary"><ShieldCheck size={18} strokeWidth={1.6} /></div><p className="text-xs leading-relaxed text-muted-foreground"><strong className="font-bold text-foreground">Evidence stays close.</strong> Signal uses local browser capabilities first and tells you when a capability is unavailable.</p></div></div>
          </section>

          {error && <div className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs reveal ${error.includes('copied') ? 'border-primary/25 bg-primary/8 text-primary' : 'border-destructive/25 bg-destructive/8 text-destructive'}`} role="status" data-testid="status-message"><div className="flex items-center gap-2">{error.includes('copied') ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {error}</div><button onClick={() => setError('')} data-testid="button-dismiss-status"><X size={15} /></button></div>}

          <div className="workspace-grid grid grid-cols-[minmax(270px,340px)_minmax(0,1fr)] items-start gap-5">
            <aside className="space-y-4">
              <section className="soft-card p-4 reveal reveal-delay-1">
                <div className="mb-4 flex items-center justify-between"><div><div className="eyebrow">01 / Intake</div><h2 className="mt-1 text-sm font-extrabold">Bring in evidence</h2></div><UploadCloud size={16} className="text-muted-foreground" /></div>
                <FileDrop onFile={makeReport} onDemo={runSample} dragging={dragging} setDragging={setDragging} />
              </section>
              {file && previewUrl && !isScanning && <section className="soft-card overflow-hidden reveal"><div className="border-b border-border px-4 py-3"><div className="eyebrow">Loaded image</div><div className="mt-1 truncate text-xs font-bold">{file.name}</div></div><div className="preview-frame flex min-h-[150px] items-center justify-center p-3"><img src={previewUrl} alt={`Preview of ${file.name}`} data-testid="img-upload-preview" /></div><div className="flex items-center justify-between px-4 py-3 mono text-[9px] text-muted-foreground"><span>{formatBytes(file.size)}</span><span>{file.type.split('/')[1]?.toUpperCase()}</span></div></section>}
              <section className="rounded-xl border border-primary/15 bg-primary/5 p-4 reveal reveal-delay-2"><div className="flex items-center gap-2 text-primary"><FileJson size={15} /><span className="text-xs font-bold">Forensic export</span></div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Every report includes the observable result, metadata, confidence language, and a privacy note.</p></section>
            </aside>
            <div>
              {isScanning && <ScanningState fileName={file?.name || 'sample-inspection.png'} progress={progress} />}
              {!isScanning && report && <ReportView report={report} onExport={exportReport} onCopy={copyReport} />}
              {!isScanning && !report && <EmptyReport />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;