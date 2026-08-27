import { useMemo, useState, type ReactNode } from 'react';
import {
  CONTRACT_FILE,
  SOLIDITY_SOURCE,
  SOLIDITY_VERSION,
} from '../data/contract';
import { Reveal, SectionHeader } from './ui';

// ── هایلایتر سبک‌وزن Solidity ─────────────────────────────────
const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*")|\b(pragma|solidity|contract|function|returns?|public|external|internal|private|pure|view|payable|mapping|struct|event|emit|require|revert|if|else|for|while|return|new|memory|storage|calldata|constant|immutable|indexed|constructor|modifier|is|import|error|unchecked)\b|\b(u?int\d*|address|bool|bytes\d*|string|msg|block|tx|abi|payable|true|false)\b|(0x[0-9a-fA-F]+|\b\d[\d_]*(?:\.\d+)?(?:e\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;

const CLASSES = [
  'text-slate-500 italic', // comment
  'text-amber', // string
  'text-base-bright font-medium', // keyword
  'text-cyan-bright', // type / builtin
  'text-orange', // number
  'text-[#8fb7ff]', // function name
];

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const gi = m.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={key++} className={CLASSES[gi] ?? ''}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function ContractSection() {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => SOLIDITY_SOURCE.split('\n'), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SOLIDITY_SOURCE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard در دسترس نیست */
    }
  };

  const download = () => {
    const blob = new Blob([SOLIDITY_SOURCE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = CONTRACT_FILE;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="contract" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="02"
        kicker="Smart Contract"
        title="کد قرارداد، آماده‌ی کامپایل"
        lead="تک‌فایل، بدون وابستگی، با Solidity 0.8.24. خطاهای سفارشی به‌جای require-های رشته‌ای و رویدادها برای ایندکس‌کردن هر حرکت — دقیقاً همان چیزی که بالای صفحه بازی می‌کنید."
      />

      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-line bg-[#050b1c] shadow-[0_30px_80px_rgba(2,8,26,0.6)]">
          {/* نوار ابزار */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
              </div>
              <span className="font-mono text-xs text-slate-300" dir="ltr">
                contracts/{CONTRACT_FILE}
              </span>
              <span className="hidden sm:inline rounded-md bg-base/15 px-2 py-0.5 font-mono text-[10px] text-base-bright" dir="ltr">
                solc {SOLIDITY_VERSION}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-2 hidden md:inline font-mono text-[11px] text-slate-500" dir="ltr">
                {lines.length} lines · ~7.2 KB
              </span>
              <button
                onClick={copy}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all active:scale-95 ${
                  copied
                    ? 'border-mint/60 bg-mint/10 text-mint'
                    : 'border-line text-slate-300 hover:border-base hover:text-white'
                }`}
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    کپی شد
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="9" y="9" width="12" height="12" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    کپی
                  </>
                )}
              </button>
              <button
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-lg bg-base px-3 py-1.5 font-mono text-[11px] text-white transition-all hover:bg-base-hi active:scale-95"
                dir="ltr"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                دانلود .sol
              </button>
            </div>
          </div>

          {/* کد */}
          <div className="max-h-[560px] overflow-auto code-scroll" dir="ltr">
            <pre className="min-w-max py-5 pr-6 font-mono text-[12.5px] leading-[1.75]">
              {lines.map((_, i) => (
                <div key={i} className="flex hover:bg-base/[0.05] transition-colors">
                  <span className="sticky left-0 w-12 shrink-0 select-none bg-[#050b1c] pr-4 text-right text-slate-700">
                    {i + 1}
                  </span>
                  <code className="whitespace-pre text-slate-300">{highlight(lines[i] + '\n')}</code>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-slate-400">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-base-bright" /> ۵ رویداد برای ایندکس کامل حرکات
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-mint" /> ۷ خطای سفارشی — بدون reason string
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-amber" /> واریز جایزه با call و بررسی موفقیت
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-rose" /> آنتروپی blockhash — برای جدی، VRF
          </span>
        </div>
      </Reveal>
    </section>
  );
}
