import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CONTRACT_FILE, SOLIDITY_VERSION, fetchContractSource } from '../data/contract';
import { Reveal, SectionHeader } from './ui';

// ── lightweight Solidity highlighter ────────────────────────────
const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*")|\b(pragma|solidity|contract|function|returns?|public|external|internal|private|pure|view|payable|mapping|struct|event|emit|require|revert|if|else|for|while|return|new|memory|storage|calldata|constant|immutable|indexed|constructor|modifier|is|import|error|unchecked|interface|override)\b|\b(u?int\d*|address|bool|bytes\d*|string|msg|block|tx|abi|payable|true|false)\b|(0x[0-9a-fA-F]+|\b\d[\d_]*(?:\.\d+)?(?:e\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;

const CLASSES = [
  'text-slate-500 italic',
  'text-amber',
  'text-base-bright font-medium',
  'text-cyan-bright',
  'text-orange',
  'text-[#8fb7ff]',
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
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchContractSource()
      .then((s) => { if (alive) setSource(s); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const lines = useMemo(() => (source ? source.split('\n') : []), [source]);

  const copy = async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const download = () => {
    if (!source) return;
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
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
        kicker="Smart Contract · ERC-721"
        title="The code, ready to compile"
        lead="One Solidity file plus the two official Chainlink VRF imports, compiled with 0.8.36. Randomness via VRF v2.5 commit–reveal, custom errors instead of string reverts, and a self-contained ERC-721 whose SVG metadata is generated inside tokenURI(). This is the exact contract the game above simulates."
      />

      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-line bg-[#050b1c] shadow-[0_30px_80px_rgba(2,8,26,0.6)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
              </div>
              <span className="font-mono text-xs text-slate-300">contracts/{CONTRACT_FILE}</span>
              <span className="hidden sm:inline rounded-md bg-base/15 px-2 py-0.5 font-mono text-[10px] text-base-bright">
                solc {SOLIDITY_VERSION}
              </span>
              <span className="hidden md:inline rounded-md bg-gold/15 px-2 py-0.5 font-mono text-[10px] text-gold">
                + VRF · ERC-721
              </span>
            </div>
            <div className="flex items-center gap-2">
              {source && (
                <span className="mr-2 hidden md:inline font-mono text-[11px] text-slate-500">
                  {lines.length} lines · {(source.length / 1024).toFixed(1)} KB
                </span>
              )}
              <button
                onClick={copy}
                disabled={!source}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all active:scale-95 disabled:opacity-40 ${
                  copied
                    ? 'border-mint/60 bg-mint/10 text-mint'
                    : 'border-line text-slate-300 hover:border-base hover:text-white'
                }`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={download}
                disabled={!source}
                className="inline-flex items-center gap-1.5 rounded-lg bg-base px-3 py-1.5 font-mono text-[11px] text-white transition-all hover:bg-base-hi active:scale-95 disabled:opacity-40"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download .sol
              </button>
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto code-scroll">
            {failed ? (
              <p className="p-6 font-mono text-sm text-rose">
                Couldn't load the contract source in this environment. Use “Download full installer” below to get it.
              </p>
            ) : !source ? (
              <div className="flex items-center gap-3 p-6">
                <span className="spinner h-5 w-5 rounded-full border-2 border-base-bright border-t-transparent" />
                <span className="font-mono text-sm text-slate-400">Loading Onchain2048.sol…</span>
              </div>
            ) : (
              <pre className="min-w-max py-5 pr-6 font-mono text-[12.5px] leading-[1.75]">
                {lines.map((line, i) => (
                  <div key={i} className="flex hover:bg-base/[0.05] transition-colors">
                    <span className="sticky left-0 w-12 shrink-0 select-none bg-[#050b1c] pr-4 text-right text-slate-700">
                      {i + 1}
                    </span>
                    <code className="whitespace-pre text-slate-300">{highlight(line + '\n')}</code>
                  </div>
                ))}
              </pre>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-slate-400">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-base-bright" /> 10 events — commit, fulfil, win, mint
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-mint" /> 10 custom errors — no reason strings
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-gold" /> NFT trophy minted at score 4096, one per player
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-amber" /> tokenURI() renders the board as SVG on-chain
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-cyan-bright" /> Chainlink VRF v2.5 commit–reveal randomness
          </span>
        </div>
      </Reveal>
    </section>
  );
}
