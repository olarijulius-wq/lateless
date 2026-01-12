'use client';

import { useState } from 'react';
import { Button } from '@/app/ui/button';

export default function ExportInvoicesButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/invoices/export', {
        method: 'GET',
      });

      if (!res.ok) {
        let message = 'Failed to export invoices.';
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(message);
      }

      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'invoices.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to export invoices.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={handleExport}
        aria-disabled={loading}
        className="secondary"
      >
        {loading ? 'Exporting…' : 'Export CSV'}
      </Button>
      {error && (
        <p className="text-xs text-red-500" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}