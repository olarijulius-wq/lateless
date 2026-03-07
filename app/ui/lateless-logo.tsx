import { lusitana } from '@/app/ui/fonts';

type LatelessLogoProps = {
  className?: string;
  compact?: boolean;
};

export default function LatelessLogo({
  className = '',
  compact = false,
}: LatelessLogoProps) {
  return (
    <span
      className={`${lusitana.className} inline-flex items-center leading-none tracking-[0.01em] ${
        compact ? 'text-2xl' : 'text-[1.65rem]'
      } ${className}`.trim()}
    >
      Lateless
    </span>
  );
}
