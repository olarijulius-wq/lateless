'use client';

import { useRouter } from 'next/navigation';

type PlanSelectButtonProps = {
  plan: 'solo' | 'pro' | 'studio';
  className?: string;
  children: React.ReactNode;
};

export default function PlanSelectButton({
  plan,
  className,
  children,
}: PlanSelectButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/dashboard/settings/billing?plan=${plan}`);
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
