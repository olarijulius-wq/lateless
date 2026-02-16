'use client';

import { useEffect, useRef, useState } from 'react';

type FitTextEmailProps = {
  email: string;
  className?: string;
  maxFontSize?: number;
  minFontSize?: number;
};

const DEFAULT_MAX_FONT_SIZE = 12;
const DEFAULT_MIN_FONT_SIZE = 9;
const FONT_STEP = 0.5;

export default function FitTextEmail({
  email,
  className,
  maxFontSize = DEFAULT_MAX_FONT_SIZE,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
}: FitTextEmailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const fitText = () => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;

      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      let nextFontSize = maxFontSize;
      text.style.fontSize = `${nextFontSize}px`;

      while (nextFontSize > minFontSize && text.scrollWidth > containerWidth) {
        nextFontSize = Math.max(minFontSize, nextFontSize - FONT_STEP);
        text.style.fontSize = `${nextFontSize}px`;
      }

      const roundedFontSize = Number(nextFontSize.toFixed(2));
      setFontSize((current) => (current === roundedFontSize ? current : roundedFontSize));
    };

    const scheduleFit = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        fitText();
        rafRef.current = null;
      });
    };

    scheduleFit();

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [email, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <p
        ref={textRef}
        className={className}
        style={{ fontSize, whiteSpace: 'nowrap' }}
        title={email}
      >
        {email}
      </p>
    </div>
  );
}
