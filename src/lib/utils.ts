export function cn(...inputs: string[]) {
  return inputs.filter(Boolean).join(' ');
}

export function formatKeywords(kw: string | string[] | undefined): string[] {
  if (!kw) return [];
  if (Array.isArray(kw)) {
    return kw.map(k => String(k).trim()).filter(Boolean);
  }
  if (typeof kw === 'string') {
    return kw.split(',').map(k => k.trim()).filter(Boolean);
  }
  return [];
}
