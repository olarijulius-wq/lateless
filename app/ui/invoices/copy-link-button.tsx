'use client';

import { useState } from 'react';
import { secondaryButtonClasses } from '@/app/ui/button';

type CopyLinkButtonProps = {
  text: string;
};

export default function CopyLinkButton({ text }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`${secondaryButtonClasses} px-3 py-2 text-xs`}
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
