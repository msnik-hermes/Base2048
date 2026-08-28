import { useState } from 'react';
import {
  ALL_FILE_COUNT,
  INLINE_FILES,
  REPO_FILES,
  buildInstaller,
  downloadText,
  fetchRepoFile,
  INSTALLER_NAME,
  type Group,
} from '../data/repoFiles';
import { Reveal, SectionHeader } from './ui';

const GROUP_LABEL: Record<Group, string> = {
  contract: 'Smart contract',
  test: 'Test suite',
  frontend: 'Frontend',
  config: 'Config & docs',
};

const GROUP_COLOR: Record<Group, string> = {
  contract: 'text-cyan-bright',
  test: 'text-mint',
  frontend: 'text-base-bright',
  config: 'text-amber',
};

const GROUP_ORDER: Group[] = ['contract', 'test', 'config', 'frontend'];

function kb(n: number) {
  return n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

export function CodeExport() {
  const [copied, setCopied] = useState<null | 'installer' | string>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  const flash = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  const downloadInstaller = async () => {
    setBuilding(true);
    setError('');
    try {
      const sh = await buildInstaller();
      downloadText(INSTALLER_NAME, sh, 'application/x-sh;charset=utf-8');
      flash('installer');
    } catch (e: any) {
      setError('Could not assemble the installer here: ' + String(e?.message ?? e));
    } finally {
      setBuilding(false);
    }
  };

  const downloadOne = async (path: string) => {
    try {
      const content = await fetchRepoFile(path);
      downloadText(path.split('/').pop()!, content);
      flash(path);
    } catch (e: any) {
      setError(`Couldn't fetch ${path}: ` + String(e?.message ?? e));
    }
  };

  return (
    <section id="export" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="06"
        kicker="One click → GitHub"
        title="Take the exact code with you"
        lead="Everything you see on this page — contract, tests, frontend, configs — is bundled below as a single installer script generated live from the real files. No copy-paste drift, no missing files: run it, then ./push.sh, done."
      />

      <div className="grid gap-8 lg:grid-cols-[400px_1fr] items-start">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-base/35 bg-panel shadow-[0_0_60px_rgba(0,82,255,0.12)]">
            <div className="border-b border-line px-5 py-4">
              <p className="font-display text-xl text-white">Repo delivery</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">
                {ALL_FILE_COUNT} files · generated live from the workspace
              </p>
            </div>

            <div className="space-y-4 p-5">
              <button
                onClick={downloadInstaller}
                disabled={building}
                className="group w-full rounded-xl bg-base px-4 py-4 text-left shadow-[0_6px_30px_rgba(0,82,255,0.4)] transition-all hover:bg-base-hi hover:shadow-[0_8px_40px_rgba(0,82,255,0.6)] active:scale-[0.98] disabled:opacity-60"
              >
                <span className="flex items-center justify-between">
                  <span className="font-display text-lg text-white">
                    {building ? (
                      <span className="flex items-center gap-2">
                        <span className="spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                        Reading workspace…
                      </span>
                    ) : copied === 'installer' ? (
                      '✓ Downloaded'
                    ) : (
                      'Download full installer'
                    )}
                  </span>
                  {!building && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-white transition-transform group-hover:translate-y-0.5">
                      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-white/70">{INSTALLER_NAME} · self-contained bash</span>
              </button>

              {error && (
                <p className="rounded-lg border border-rose/30 bg-rose/10 px-3.5 py-2.5 font-mono text-[11px] leading-5 text-rose">
                  {error}
                </p>
              )}

              <ol className="space-y-3">
                {[
                  ['Run it anywhere with bash', 'bash install-base2048.sh — writes every file into the current folder (Git Bash / WSL / Terminal).'],
                  ['Push to GitHub', './push.sh — commits and pushes to github.com/msnik/Base2048, handling init, remote and branch for you.'],
                  ['Verify on GitHub', 'Open contracts/Onchain2048.sol on the repo — it is byte-identical to what this site displays.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-base/15 font-mono text-[11px] font-bold text-base-bright">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{t}</p>
                      <p className="mt-0.5 text-[12px] leading-5 text-slate-400">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-lg border border-line/70 bg-ink px-3.5 py-3">
                <p className="font-mono text-[11px] leading-6 text-slate-500">
                  <span className="text-slate-300">Why this exists:</span> the workspace has no shell, so nothing can be
                  pushed from here directly. The installer moves the whole repo to your machine in one file — then git does
                  the rest. <span className="text-amber">Never paste GitHub tokens into a chat.</span>
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-4">
              <h3 className="font-display text-xl text-white">What's inside</h3>
              <span className="font-mono text-[11px] text-slate-500">click any file to download it alone</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto code-scroll">
              {GROUP_ORDER.map((g) => {
                const repoFiles = REPO_FILES.filter((f) => f.group === g);
                const inlineFiles = INLINE_FILES.filter((f) => f.group === g);
                if (repoFiles.length === 0 && inlineFiles.length === 0) return null;
                return (
                  <div key={g}>
                    <p className={`sticky top-0 z-10 border-b border-line/60 bg-ink/95 px-5 py-2 font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${GROUP_COLOR[g]} backdrop-blur`}>
                      {GROUP_LABEL[g]}
                    </p>
                    <ul>
                      {[...repoFiles.map((f) => f.path), ...inlineFiles.map((f) => f.path)].map((path) => {
                        const inline = inlineFiles.find((f) => f.path === path);
                        const size = inline ? inline.content.length : undefined;
                        return (
                          <li key={path}>
                            <button
                              onClick={() => downloadOne(path)}
                              className="group flex w-full items-center justify-between gap-3 border-b border-line/40 px-5 py-2.5 text-left transition-colors hover:bg-base/[0.05]"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-mono text-[12px] text-slate-200 transition-colors group-hover:text-white">
                                  {path}
                                </span>
                                {size !== undefined && <span className="font-mono text-[10px] text-slate-600">{kb(size)} · inline</span>}
                              </span>
                              <span
                                className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] transition-all ${
                                  copied === path
                                    ? 'border-mint/60 text-mint'
                                    : 'border-line text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-white group-hover:border-base'
                                }`}
                              >
                                {copied === path ? '✓ saved' : '↓ get'}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line bg-panel px-5 py-3">
              <p className="font-mono text-[10.5px] leading-5 text-slate-500">
                package-lock.json is intentionally excluded — <span className="text-slate-300">npm install</span> regenerates it.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
