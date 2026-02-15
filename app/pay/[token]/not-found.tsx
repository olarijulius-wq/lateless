export default function PayLinkNotFound() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-neutral-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-100">
            Link expired
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-zinc-300">
            This payment link is no longer valid. Please ask the sender for a new one.
          </p>
        </div>
      </div>
    </main>
  );
}
