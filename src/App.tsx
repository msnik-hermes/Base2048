import { ArchSection } from './components/ArchSection';
import { Background, Footer, TopBar } from './components/Chrome';
import { ContractSection } from './components/ContractSection';
import { DeploySection } from './components/DeploySection';
import { GameBoard } from './components/GameBoard';
import { RemixSection } from './components/RemixSection';
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
          A fully on-chain game on Base
        </p>
        <h1 className="font-display text-4xl leading-[1.15] text-white md:text-5xl">
          2048 —<span className="text-base-bright"> every move</span>
          <br />
          is a transaction
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-8 text-slate-400">
          The board lives in a single <span className="font-mono text-cyan-bright">uint64</span> and this page runs
          the exact same Solidity algorithm as the contract below. Push a direction — the transaction log fills
          instantly, and if your score crosses{' '}
          <span className="font-mono text-gold">4096</span> the contract mints you a one-of-one NFT.
        </p>
      </div>
      <div className="flex shrink-0 rounded-2xl border border-line bg-panel">
        {[
          { label: 'Entry fee', value: '0.000042 ETH', sub: 'start()' },
          { label: 'Gas / move', value: '≈ 35k', sub: liveBlock > 0 ? `${gwei} gwei now` : 'move(uint8)' },
          { label: 'NFT trophy', value: '@ 4,096 pts', sub: 'ERC-721 · on-chain SVG' },
        ].map((s, i) => (
          <div key={s.label} className={`px-5 py-4 ${i > 0 ? 'border-s border-line' : ''}`}>
            <p className="text-[10px] text-slate-500 mb-1">{s.label}</p>
            <p className="font-display text-lg leading-none text-white">{s.value}</p>
            <p className="mt-1 font-mono text-[9px] text-slate-600">{s.sub}</p>
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
          {/* ═══ opens with the game itself ═══ */}
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
                  nft={game.nft}
                  onMove={game.move}
                  onRestart={game.restart}
                  onContinue={game.continueAfterWin}
                />
                <p className="mt-4 text-center text-[12px] text-slate-600">
                  On the real contract, every arrow key is a <span className="font-mono text-slate-500">move(dir)</span> signed by you
                </p>
              </div>
              <SidePanel
                score={game.score}
                best={game.best}
                moves={game.moves}
                tiles={game.tiles}
                lastGain={game.lastGain}
                txs={game.txs}
                nft={game.nft}
                nftLifetime={game.nftLifetime}
                canUndo={game.canUndo}
                liveBlock={chain.block}
                onRestart={game.restart}
                onUndo={game.undo}
              />
            </div>
          </section>

          <ArchSection tiles={game.tiles} />
          <ContractSection />
          <RemixSection tiles={game.tiles} score={game.score} moves={game.moves} />
          <DeploySection liveBlock={chain.block} />
        </main>

        <Footer />
      </div>
    </div>
  );
}
