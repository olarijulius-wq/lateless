type LatelessLogoProps = {
  className?: string;
  compact?: boolean;
};

export default function LatelessLogo({
  className = '',
  compact = false,
}: LatelessLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top_left,_#86efac,_#14b8a6_55%,_#0f172a)] shadow-[0_10px_22px_rgba(20,184,166,0.28)]">
        <span className="absolute inset-[3px] rounded-[14px] border border-white/20" />
        <span className="text-lg font-semibold tracking-[-0.04em] text-white">L</span>
      </span>
      {!compact ? (
        <span className="text-[1.65rem] font-semibold tracking-[-0.06em] text-slate-900 dark:text-slate-100">
          Lateless
        </span>
      ) : null}
    </div>
  );
}
