import { ArchSection } from './components/ArchSection';
import { Background, Footer, TopBar } from './components/Chrome';
import { ContractSection } from './components/ContractSection';
import { DeploySection } from './components/DeploySection';
import { GameBoard } from './components/GameBoard';
import { SidePanel } from './components/SidePanel';
import { useBaseChain } from './hooks/useBaseChain';
import { useGame } from './game/useGame';

function GameIntro({ liveBlock, gwei }: { liveBlock: number; gwei: number }) {
  return (
    <div className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-base/40 bg-base/10 px-4 py-1.5 text-xs font-bold text-base-bright">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          بازی کاملاً روی‌زنجیره‌ای روی Base
        </p>
        <h1 className="font-display text-5xl leading-[1.15] text-white md:text-6xl">
          ۲۰۴۸؛
          <br />
          هر حرکت،<span className="text-base-bright"> یک تراکنش</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-8 text-slate-400">
          صفحه‌ی بازی در یک <span className="font-mono text-cyan-bright" dir="ltr">uint64</span> زندگی می‌کند و
          دقیقاً همان الگوریتم Solidity پایین صفحه، اینجا اجرا می‌شود. جهت‌ها را بزن — لاگ تراکنش‌ها همان لحظه
          پر می‌شود و اسنپ‌شات storage جلوی چشمت عوض می‌شود.
        </p>
      </div>
      <div className="flex shrink-0 rounded-2xl border border-line bg-panel" dir="rtl">
        {[
          { label: 'کارمزد ورود', value: '0.000042 ETH', sub: 'start()' },
          { label: 'گس هر حرکت', value: '≈ 35k', sub: liveBlock > 0 ? `${gwei} gwei الان` : 'move(uint8)' },
          { label: 'جایزه‌ی ۲۰۴۸', value: '٪۹۰ pot', sub: 'واریز آنی' },
        ].map((s, i) => (
          <div key={s.label} className={`px-5 py-4 ${i > 0 ? 'border-s border-line' : ''}`}>
            <p className="text-[10px] text-slate-500 mb-1">{s.label}</p>
            <p className="font-display text-lg leading-none text-white" dir="ltr">{s.value}</p>
            <p className="mt-1 font-mono text-[9px] text-slate-600" dir="ltr">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const chain = useBaseChain();
  const game = useGame(chain.block);

  return (
    <div className="relative min-h-screen overflow-x-clip text-slate-200">
      <Background />
      <div className="relative z-10">
        <TopBar chain={chain} />

        <main>
          {/* ═══ شروع با خود بازی ═══ */}
          <section id="game" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 pt-12 md:pt-16">
            <GameIntro liveBlock={chain.block} gwei={chain.gwei} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-8">
              <div className="mx-auto w-full max-w-[520px]">
                <GameBoard
                  tiles={game.tiles}
                  won={game.won}
                  over={game.over}
                  keepPlaying={game.keepPlaying}
                  nudgeKey={game.nudgeKey}
                  onMove={game.move}
                  onRestart={game.restart}
                  onContinue={game.continueAfterWin}
                />
                <p className="mt-4 text-center text-[12px] text-slate-600">
                  روی قرارداد واقعی، هر فلش کیبورد یعنی یک <span className="font-mono text-slate-500" dir="ltr">move(dir)</span> با امضای تو
                </p>
              </div>
              <SidePanel
                score={game.score}
                best={game.best}
                moves={game.moves}
                tiles={game.tiles}
                lastGain={game.lastGain}
                txs={game.txs}
                canUndo={game.canUndo}
                liveBlock={chain.block}
                onRestart={game.restart}
                onUndo={game.undo}
              />
            </div>
          </section>

          <ArchSection tiles={game.tiles} />
          <ContractSection />
          <DeploySection liveBlock={chain.block} />
        </main>

        <Footer />
      </div>
    </div>
  );
}
