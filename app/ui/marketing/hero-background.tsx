'use client';

import clsx from 'clsx';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

type HeroBackgroundProps = {
  className?: string;
  muted?: boolean;
};

const floating = [
  {
    className:
      'h-32 w-32 rounded-[38%_62%_60%_40%/52%_35%_65%_48%] bg-[radial-gradient(circle_at_30%_30%,var(--mk-glow-strong),transparent_72%)] blur-[1px] md:h-44 md:w-44',
    position: 'left-[5%] top-[12%]',
    y: [0, -10, 0],
    x: [0, 8, 0],
    rotate: [0, 6, 0],
    duration: 16,
  },
  {
    className:
      'h-24 w-24 rounded-[42%_58%_55%_45%/48%_42%_58%_52%] bg-[radial-gradient(circle_at_36%_30%,var(--mk-glow-soft),transparent_72%)] blur-[0.5px] md:h-28 md:w-28',
    position: 'right-[9%] top-[10%]',
    y: [0, 8, 0],
    x: [0, -10, 0],
    rotate: [0, -5, 0],
    duration: 18,
  },
  {
    className:
      'h-40 w-40 rounded-full bg-[radial-gradient(circle_at_35%_35%,var(--mk-glow-soft),transparent_70%)] blur-[1px] md:h-52 md:w-52',
    position: 'right-[14%] bottom-[20%]',
    y: [0, -8, 0],
    x: [0, 6, 0],
    rotate: [0, 8, 0],
    duration: 20,
  },
  {
    className:
      'h-20 w-20 rounded-[56%_44%_38%_62%/44%_56%_42%_58%] bg-[radial-gradient(circle_at_40%_35%,var(--mk-glow-strong),transparent_75%)] blur-[0.5px] md:h-24 md:w-24',
    position: 'left-[18%] bottom-[16%]',
    y: [0, -6, 0],
    x: [0, 5, 0],
    rotate: [0, 7, 0],
    duration: 17,
  },
];

export default function HeroBackground({ className, muted = false }: HeroBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const farParallaxY = useTransform(scrollYProgress, [0, 1], [0, -12]);
  const nearParallaxY = useTransform(scrollYProgress, [0, 1], [0, -24]);

  return (
    <div
      aria-hidden="true"
      className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(130%_95%_at_50%_0%,rgba(255,255,255,0.42),transparent_58%)] dark:bg-[radial-gradient(122%_94%_at_50%_0%,rgba(0,0,0,0.76),transparent_62%)]" />

      <motion.div
        className={clsx(
          'absolute inset-0 opacity-85',
          muted
            ? 'bg-[radial-gradient(80%_62%_at_50%_8%,var(--mk-glow-soft),transparent_62%),radial-gradient(58%_50%_at_84%_22%,var(--mk-glow-strong),transparent_70%)] dark:bg-[var(--mk-dark-glow),radial-gradient(58%_50%_at_84%_22%,var(--mk-glow-strong),transparent_72%)]'
            : 'bg-[radial-gradient(82%_64%_at_50%_8%,var(--mk-glow-strong),transparent_60%),radial-gradient(56%_46%_at_84%_22%,var(--mk-glow-soft),transparent_68%)] dark:bg-[var(--mk-dark-glow),radial-gradient(56%_46%_at_84%_22%,var(--mk-glow-soft),transparent_70%)]',
        )}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                backgroundPosition: ['50% 0%, 84% 22%', '46% 12%, 88% 16%', '50% 0%, 84% 22%'],
              }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 28,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'mirror',
                ease: 'easeInOut',
              }
        }
      />

      <motion.div
        className={clsx(
          'absolute inset-0 opacity-75',
          muted
            ? 'bg-[radial-gradient(50%_34%_at_14%_16%,var(--mk-glow-soft),transparent_72%),radial-gradient(38%_30%_at_72%_30%,var(--mk-glow-strong),transparent_76%)]'
            : 'bg-[radial-gradient(52%_36%_at_14%_16%,var(--mk-glow-strong),transparent_72%),radial-gradient(38%_30%_at_72%_30%,var(--mk-glow-soft),transparent_76%)]',
        )}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                backgroundPosition: ['14% 16%, 72% 30%', '20% 22%, 66% 24%', '14% 16%, 72% 30%'],
              }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 34,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'mirror',
                ease: 'easeInOut',
              }
        }
      />

      <div className="absolute inset-x-0 bottom-[-16%] h-[52%] [transform:perspective(1050px)_rotateX(64deg)]">
        <div className="absolute inset-0 bg-[radial-gradient(76%_58%_at_50%_92%,rgba(21,128,61,0.18),transparent_70%)] dark:bg-[radial-gradient(76%_58%_at_50%_92%,rgba(21,128,61,0.14),transparent_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_72%_at_50%_96%,rgba(20,20,20,0.18),transparent_68%)] dark:bg-[radial-gradient(90%_72%_at_50%_96%,rgba(0,0,0,0.76),transparent_72%)]" />
      </div>

      <div className="absolute inset-0 dark:bg-[radial-gradient(96%_72%_at_50%_84%,transparent,rgba(0,0,0,0.62)_74%)]" />

      <div className="absolute inset-0 hidden md:block">
        {floating.map((item, index) => {
          const parallaxY = index % 2 === 0 ? nearParallaxY : farParallaxY;

          if (prefersReducedMotion) {
            return (
              <div key={index} className={clsx('absolute opacity-80', item.position, item.className)} />
            );
          }

          return (
            <motion.div key={index} className={clsx('absolute opacity-80', item.position)} style={{ y: parallaxY }}>
              <motion.div
                className={clsx('will-change-transform', item.className)}
                animate={{ y: item.y, x: item.x, rotate: item.rotate }}
                transition={{ duration: item.duration, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
