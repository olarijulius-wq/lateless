'use client';
 
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { DARK_INPUT } from '@/app/ui/theme/tokens';
import clsx from 'clsx';
 
type SearchProps = {
  placeholder: string;
  className?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

export default function Search({ placeholder, className, onFocus, onBlur }: SearchProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);
 
  return (
    <div className={clsx('relative flex flex-1 shrink-0', className)}>
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        className={`peer block w-full rounded-xl border border-slate-300 bg-white py-[9px] pl-10 text-sm text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40 ${DARK_INPUT}`}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => {
          handleSearch(e.target.value);
        }}
        defaultValue={searchParams.get('query')?.toString()}
      />
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500 transition peer-focus:text-slate-700 dark:peer-focus:text-zinc-300" />
    </div>
  );
}
