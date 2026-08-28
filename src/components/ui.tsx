import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Soft scroll-reveal wrapper */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'reveal-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Primary button with press feedback */
export function ActionButton({
  children,
  onClick,
  variant = 'solid',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'solid' | 'ghost' | 'amber' | 'gold';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-150 active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none select-none';
  const styles = {
    solid: 'bg-base text-white shadow-[0_4px_20px_rgba(0,82,255,0.4)] hover:bg-base-hi hover:shadow-[0_6px_28px_rgba(0,82,255,0.55)]',
    ghost: 'border border-line text-slate-300 hover:border-base hover:text-white hover:bg-base/10',
    amber: 'bg-amber text-[#3a2400] shadow-[0_4px_20px_rgba(255,176,58,0.35)] hover:brightness-110',
    gold: 'bg-gold text-[#3d2a00] shadow-[0_4px_20px_rgba(255,215,106,0.35)] hover:brightness-110',
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function SectionHeader({
  index,
  kicker,
  title,
  lead,
}: {
  index: string;
  kicker: string;
  title: string;
  lead?: string;
}) {
  return (
    <Reveal>
      <div className="mb-10 flex items-end gap-5">
        <span className="font-mono text-sm text-base-dim leading-none pb-2" dir="ltr">
          {index}
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-line to-transparent translate-y-[-6px]" />
      </div>
      <p className="text-xs font-bold tracking-[0.35em] text-cyan-bright uppercase mb-3">{kicker}</p>
      <h2 className="font-display text-4xl md:text-5xl text-white leading-tight">{title}</h2>
      {lead && <p className="mt-4 max-w-2xl text-slate-400 leading-8">{lead}</p>}
    </Reveal>
  );
}
