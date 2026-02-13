export function normalizeVat(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const firstSegment = trimmed.split('/')[0] ?? '';
  return firstSegment.replace(/\s+/g, ' ').trim();
}
