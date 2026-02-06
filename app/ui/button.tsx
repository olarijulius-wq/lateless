import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'toolbar';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
}

const baseClasses =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50';

export const toolbarButtonClasses =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 text-sm font-medium text-slate-50 transition-colors transition-transform duration-150 ease-out hover:bg-slate-900/80 hover:text-slate-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-slate-700/70 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:scale-[1.01]',
  secondary:
    'border border-slate-700 bg-slate-900/60 text-slate-100 hover:border-slate-500 hover:bg-slate-900/80 hover:scale-[1.01]',
  destructive:
    'border border-rose-500/40 bg-rose-500/20 text-rose-100 hover:border-rose-400/60 hover:bg-rose-500/30 hover:scale-[1.01]',
  toolbar:
    'border border-slate-700 bg-slate-950/60 text-slate-50 transition-colors transition-transform duration-150 ease-out hover:bg-slate-900/80 hover:text-slate-200 hover:scale-[1.02]',
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
