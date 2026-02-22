export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-amber-200/10 blur-3xl dark:bg-emerald-300/10" />

      <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-black p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] dark:border-zinc-800 dark:from-black dark:to-zinc-950 dark:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_24px_70px_rgba(0,0,0,0.62)]">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
            Lateless live view
          </p>
          <span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200">
            synced
          </span>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 dark:border-emerald-900/60 dark:bg-black">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-400">Pending this week</p>
              <p className="text-sm font-semibold text-white">€7,480</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-neutral-800 dark:bg-zinc-900">
              <div className="h-2 w-2/3 rounded-full bg-neutral-200/80 dark:bg-emerald-200/80" />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 dark:border-emerald-900/60 dark:bg-black">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Reminder queue</span>
              <span className="text-neutral-300">Today</span>
            </div>
            <div className="h-9 rounded-lg border border-neutral-800 bg-neutral-900/70 dark:border-emerald-900/50 dark:bg-zinc-950/80" />
            <div className="h-9 rounded-lg border border-neutral-800 bg-neutral-900/40 dark:border-emerald-900/40 dark:bg-zinc-950/55" />
            <div className="h-9 rounded-lg border border-neutral-800 bg-neutral-900/20 dark:border-emerald-900/30 dark:bg-zinc-950/35" />
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 dark:border-emerald-900/60 dark:bg-black">
            <div className="grid grid-cols-4 gap-2">
              <div className="h-12 rounded-lg bg-neutral-800/80 dark:bg-zinc-900/90" />
              <div className="h-12 rounded-lg bg-neutral-800/60 dark:bg-zinc-900/70" />
              <div className="h-12 rounded-lg bg-neutral-800/50 dark:bg-zinc-900/60" />
              <div className="h-12 rounded-lg bg-neutral-800/70 dark:bg-zinc-900/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
