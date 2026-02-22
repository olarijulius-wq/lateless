import clsx from 'clsx';
import { lusitana } from '@/app/ui/fonts';
import {
  BUTTON_INTERACTIVE,
  LIGHT_BUTTON_PRIMARY,
  LIGHT_BUTTON_SECONDARY,
} from '@/app/ui/theme/tokens';

export const MARKETING_CANVAS = 'marketing-theme relative min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]';

export const MARKETING_SKIP_LINK =
  'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-[var(--mk-fg-strong)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--mk-bg)]';

export const MARKETING_CONTAINER_WIDE = 'mx-auto w-[min(92vw,1360px)] lg:w-[min(90vw,1360px)]';
export const MARKETING_CONTAINER_READING = 'mx-auto w-[min(92vw,760px)] lg:w-[min(90vw,760px)]';

export const MARKETING_PAGE_PY = 'py-14 sm:py-16 lg:py-20';
export const MARKETING_SECTION_PY = 'py-14 sm:py-16 lg:py-20';
export const MARKETING_SECTION_BORDER =
  'border-t border-[color:var(--mk-border)] dark:hover:border-[color:var(--mk-dark-border-accent)]';

export const MARKETING_EYEBROW =
  'text-xs uppercase tracking-[0.16em] text-[color:var(--mk-fg-soft)]';
export const MARKETING_H1 = `${lusitana.className} text-4xl leading-[1.05] tracking-tight text-[var(--mk-fg-strong)] sm:text-5xl lg:text-6xl`;
export const MARKETING_H2 = `${lusitana.className} text-3xl leading-tight tracking-tight text-[var(--mk-fg-strong)] sm:text-4xl lg:text-5xl`;
export const MARKETING_H3 = 'text-base font-medium text-[var(--mk-fg-strong)]';
export const MARKETING_BODY = 'text-sm leading-relaxed text-[color:var(--mk-fg)] sm:text-[15px]';
export const MARKETING_BODY_MUTED = 'text-sm text-[color:var(--mk-fg-muted)]';

export const MARKETING_CARD_SURFACE =
  'rounded-3xl border border-[color:var(--mk-border)] bg-[color:var(--mk-surface)] shadow-[0_22px_60px_var(--mk-shadow)] backdrop-blur dark:bg-[var(--mk-dark-surface)] dark:hover:border-[color:var(--mk-dark-border-accent)]';
export const MARKETING_CARD_SURFACE_SOFT =
  'rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-surface-soft)] dark:bg-[var(--mk-dark-surface-2)] dark:hover:border-[color:var(--mk-dark-border-accent)]';
export const MARKETING_CODE_SURFACE =
  'overflow-x-auto rounded-2xl border border-[color:var(--mk-code-border)] bg-[color:var(--mk-code-bg)] p-4 text-xs leading-relaxed text-[color:var(--mk-code-fg)] shadow-[0_14px_34px_var(--mk-code-shadow)] dark:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_14px_34px_var(--mk-code-shadow)]';
export const MARKETING_CARD_HOVER =
  'transition-all duration-300 ease-out hover:-translate-y-px hover:border-[color:var(--mk-border-strong)] dark:hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_22px_60px_var(--mk-shadow)]';
export const MARKETING_SUBTLE_HOVER =
  'transition-colors duration-200 hover:text-[var(--mk-fg-strong)] dark:hover:text-emerald-200';

export const MARKETING_BUTTON_PRIMARY = clsx(
  'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mk-bg)] dark:focus-visible:ring-emerald-500/40 dark:hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_10px_26px_rgba(5,150,105,0.18)]',
  BUTTON_INTERACTIVE,
  LIGHT_BUTTON_PRIMARY,
  'dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100',
);
export const MARKETING_BUTTON_SECONDARY = clsx(
  'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mk-bg)] dark:focus-visible:ring-emerald-500/40 dark:hover:border-emerald-900 dark:hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]',
  BUTTON_INTERACTIVE,
  LIGHT_BUTTON_SECONDARY,
  'dark:border-zinc-800 dark:bg-black dark:text-white dark:hover:bg-zinc-950',
);

export const MARKETING_DIVIDER = 'h-px w-full bg-[color:var(--mk-border)]';
