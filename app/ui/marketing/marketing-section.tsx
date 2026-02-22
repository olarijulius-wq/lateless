import type { ReactNode } from 'react';
import clsx from 'clsx';
import {
  MARKETING_CONTAINER_WIDE,
  MARKETING_SECTION_BORDER,
  MARKETING_SECTION_PY,
} from '@/app/ui/marketing/tokens';

type MarketingSectionProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  border?: boolean;
};

export default function MarketingSection({
  children,
  className,
  containerClassName,
  border = true,
}: MarketingSectionProps) {
  return (
    <section className={clsx(border && MARKETING_SECTION_BORDER, className)}>
      <div className={clsx(MARKETING_CONTAINER_WIDE, MARKETING_SECTION_PY, containerClassName)}>
        {children}
      </div>
    </section>
  );
}
