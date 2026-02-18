import clsx from 'clsx';
import { DARK_SETTINGS_SURFACE, LIGHT_SURFACE } from '@/app/ui/theme/tokens';

export default function PricingPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        `rounded-2xl border p-6 ${LIGHT_SURFACE} ${DARK_SETTINGS_SURFACE}`,
        className,
      )}
    >
      {children}
    </div>
  );
}
