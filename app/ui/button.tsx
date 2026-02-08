import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'toolbar';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
}

const baseClasses =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50';

export const primaryButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-neutral-900 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 transition duration-200 ease-out hover:bg-slate-800 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-neutral-700 dark:bg-black dark:text-white dark:hover:bg-neutral-950 dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50';

export const toolbarButtonClasses = clsx(primaryButtonClasses, 'h-10');

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-black bg-black text-white hover:bg-neutral-900 hover:scale-[1.01] dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100',
  secondary:
    'border border-slate-900 bg-slate-900 text-slate-50 hover:bg-slate-800 hover:scale-[1.01] dark:border-neutral-700 dark:bg-black dark:text-white dark:hover:bg-neutral-950',
  destructive:
    'border border-rose-500/40 bg-rose-500/20 text-rose-100 hover:border-rose-400/60 hover:bg-rose-500/30 hover:scale-[1.01]',
  toolbar:
    'border border-black bg-black text-white transition-colors transition-transform duration-150 ease-out hover:bg-neutral-900 hover:text-white hover:scale-[1.02] dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100',
};

export function Button({
  children,
  className,
  variant = 'primary',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(baseClasses, variantClasses[variant], className)}
    >
      {children}
    </button>
  );
}
