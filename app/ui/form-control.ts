import { NEUTRAL_FOCUS_RING_CLASSES } from '@/app/ui/dashboard/neutral-interaction';

export const SETTINGS_INPUT_CLASSES =
  `w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-slate-100 dark:placeholder:text-slate-500 ${NEUTRAL_FOCUS_RING_CLASSES}`;

export const SETTINGS_SELECT_CLASSES = SETTINGS_INPUT_CLASSES;

export const SETTINGS_TEXTAREA_CLASSES = SETTINGS_INPUT_CLASSES;

export const SETTINGS_CHECKBOX_CLASSES =
  `h-4 w-4 rounded border-slate-400 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 ${NEUTRAL_FOCUS_RING_CLASSES}`;
