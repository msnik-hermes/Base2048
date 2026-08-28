import { Component, useState, type ReactNode } from 'react';
import { ArchSection } from './components/ArchSection';
import { Background, Footer, GetCodeFab, TopBar } from './components/Chrome';
import { CodeExport } from './components/CodeExport';
import { ContractSection } from './components/ContractSection';
import { DeploySection } from './components/DeploySection';
import { GameBoard } from './components/GameBoard';
import { OnchainBar } from './components/OnchainBar';
import { RemixSection } from './components/RemixSection';
import { SecurityReview } from './components/SecurityReview';
import { SidePanel } from './components/SidePanel';
import { useBaseChain } from './hooks/useBaseChain';
import { useOnchain, type NetId } from './hooks/useOnchain';
import { useGame } from './game/useGame';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#060c1c] p-6">
          <div className="max-w-lg rounded-2xl border border-rose/40 bg-panel p-8 text-center">
            <p className="font-display text-2xl text-rose">Something broke</p>
            <p className="mt-3 font-mono text-[12px] leading-6 text-slate-400 break-all">
              {String(this.state.error?.message ?? this.state.error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg bg-base px-6 py-2.5 font-display text-sm text-white hover:bg-base-hi transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
          The board lives in a single <span className="font-mono text-cyan-bright">uint64</span>, randomness comes from{' '}
          <span className="font-mono text-mint">Chainlink VRF</span>, and this page runs the exact same Solidity algorithm
          as the contract below. Push a direction — the transaction log fills instantly, and if your score crosses{' '}
          <span className="font-mono text-gold">4096</span> the contract mints you a one-of-one NFT. Deployed your own
          copy? Plug its address in below and play it live with your wallet.
        </p>
      </div>
      <div className="flex shrink-0 rounded-2xl border border-line bg-panel">
        {[
          { label: 'Entry', value: 'Free', sub: 'start() · gas only' },
          { label: 'Gas / move', value: '≈ 85k', sub: liveBlock > 0 ? `${gwei} gwei now` : 'move(uint8)' },
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
  return (
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  );
}

function Main() {
  const chain = useBaseChain();
  const [netId, setNetId] = useState<NetId>('sepolia');
  const [contractAddr, setContractAddr] = useState('');
  const oc = useOnchain(netId, contractAddr);
  const onchain = oc.active;
  const game = useGame(chain.block, !onchain);

  const tiles = onchain ? oc.tiles : game.tiles;
  const score = onchain ? oc.state?.score ?? 0 : game.score;
  const moves = onchain ? oc.state?.moves ?? 0 : game.moves;
  const won = onchain ? oc.state?.runState === 2 : game.won;
  const over = onchain ? oc.state?.runState === 3 : game.over;
  const noRun = onchain && (oc.state?.runState ?? 0) === 0;
  const onchainNft = onchain
    ? {
        id: oc.state?.nftId ?? 0,
        image: oc.nftImage,
        link:
          oc.state && oc.state.nftId > 0
            ? `${oc.net.explorer}/nft/${contractAddr.trim()}/${oc.state.nftId}`
            : null,
      }
    : null;

  return (
    <div className="relative min-h-screen overflow-x-clip text-slate-200">
      <Background />
      <div className="relative z-10">
        <TopBar chain={chain} />

        <main>
          <section id="game" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 pt-12 md:pt-16">
            <GameIntro liveBlock={chain.block} gwei={chain.gwei} />

            <OnchainBar
              netId={netId}
              onNet={setNetId}
              address={contractAddr}
              onAddress={setContractAddr}
              oc={oc}
            />

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-8">
              <div className="mx-auto w-full max-w-[520px]">
                <GameBoard
                  tiles={tiles}
                  won={won}
                  over={over}
                  keepPlaying={onchain ? false : game.keepPlaying}
                  nudgeKey={onchain ? oc.nudgeKey : game.nudgeKey}
                  nft={onchain ? oc.nftReward : game.nft}
                  pending={onchain ? oc.pending : null}
                  noRun={noRun}
                  onMove={onchain ? oc.play : game.move}
                  onRestart={onchain ? oc.startRun : game.restart}
                  onContinue={onchain ? oc.startRun : game.continueAfterWin}
                />
                <p className="mt-4 text-center text-[12px] text-slate-600">
                  {onchain ? (
                    <>
                      Connected to <span className="font-mono text-mint">{oc.net.label}</span> — every arrow key sends a
                      real, wallet-signed <span className="font-mono text-slate-500">move(dir)</span>
                    </>
                  ) : (
                    <>
                      On the real contract, every arrow key is a{' '}
                      <span className="font-mono text-slate-500">move(dir)</span> signed by you
                    </>
                  )}
                </p>
              </div>
              <SidePanel
                score={score}
                best={game.best}
                moves={moves}
                tiles={tiles}
                lastGain={onchain ? null : game.lastGain}
                txs={onchain ? oc.txs : game.txs}
                nft={onchain ? oc.nftReward : game.nft}
                nftLifetime={game.nftLifetime}
                canUndo={game.canUndo}
                liveBlock={chain.block}
                onchain={onchain}
                explorer={onchain ? oc.net.explorer : null}
                onchainNft={onchainNft}
                onRestart={onchain ? oc.startRun : game.restart}
                onUndo={game.undo}
              />
            </div>
          </section>

          <ArchSection tiles={tiles} />
          <ContractSection />
          <RemixSection tiles={tiles} score={score} moves={moves} />
          <DeploySection liveBlock={chain.block} />
          <CodeExport />
          <SecurityReview />
        </main>

        <Footer />
      </div>
      <GetCodeFab />
    </div>
  );
}
