'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { PropsWithChildren, ReactNode } from 'react';
import { Children } from 'react';
import clsx from 'clsx';

const DEFAULT_DURATION = 0.28;
const DEFAULT_Y = 8;

type RevealProps = {
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
};

export function RevealOnScroll({
  children,
  className,
  delay = 0,
  duration = DEFAULT_DURATION,
  y = DEFAULT_Y,
}: PropsWithChildren<RevealProps>) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export function RevealOnMount({
  children,
  className,
  delay = 0,
  duration = DEFAULT_DURATION,
  y = DEFAULT_Y,
}: PropsWithChildren<RevealProps>) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

type StaggeredListProps = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  y?: number;
  mode?: 'scroll' | 'mount';
};

export function StaggeredList({
  children,
  className,
  itemClassName,
  delay = 0,
  stagger = 0.08,
  duration = DEFAULT_DURATION,
  y = DEFAULT_Y,
  mode = 'scroll',
}: StaggeredListProps) {
  const items = Children.toArray(children);
  const Wrapper = mode === 'mount' ? RevealOnMount : RevealOnScroll;

  return (
    <div className={clsx(className)}>
      {items.map((child, index) => (
        <Wrapper
          key={index}
          className={itemClassName}
          delay={delay + index * stagger}
          duration={duration}
          y={y}
        >
          {child}
        </Wrapper>
      ))}
    </div>
  );
}
