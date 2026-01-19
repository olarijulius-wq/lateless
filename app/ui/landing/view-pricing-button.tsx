'use client';

type ViewPricingButtonProps = {
  className?: string;
};

export default function ViewPricingButton({ className }: ViewPricingButtonProps) {
  const handleClick = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      View pricing
    </button>
  );
}
