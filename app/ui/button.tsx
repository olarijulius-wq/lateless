import clsx from 'clsx';
import {
  BUTTON_INTERACTIVE,
  LIGHT_BUTTON_PRIMARY,
  LIGHT_BUTTON_SECONDARY,
} from '@/app/ui/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'toolbar';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
}

const baseClasses = clsx(
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50',
  BUTTON_INTERACTIVE,
);

export const primaryButtonClasses = clsx(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50',
  BUTTON_INTERACTIVE,
  LIGHT_BUTTON_PRIMARY,
  'dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100',
);

export const secondaryButtonClasses = clsx(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50',
  BUTTON_INTERACTIVE,
  LIGHT_BUTTON_SECONDARY,
  'dark:border-neutral-700 dark:bg-black dark:text-white dark:hover:bg-neutral-950',
);

export const toolbarButtonClasses = clsx(primaryButtonClasses, 'h-10');

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    `${LIGHT_BUTTON_PRIMARY} dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100`,
  secondary:
    `${LIGHT_BUTTON_SECONDARY} dark:border-neutral-700 dark:bg-black dark:text-white dark:hover:bg-neutral-950`,
  destructive:
    'border border-rose-500/40 bg-rose-500/20 text-rose-100 hover:border-rose-400/60 hover:bg-rose-500/30',
  toolbar:
    `${LIGHT_BUTTON_PRIMARY} dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100`,
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
