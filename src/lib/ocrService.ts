/**
 * OCR Service for Scanned & Mixed PDF Documents.
 * 
 * Safely renders scanned pages to lightweight offscreen images and communicates
 * with the server OCR pipeline (Gemini Vision with Tesseract fallback) to build
 * a fast, persistent search index.
 */

import { getStoredDocumentOcr, saveOcrPage, StoredPageOcr } from './ocrStorage';

export interface OcrProgressState {
  isIndexing: boolean;
  isScanned: boolean;
  scannedPagesCount: number;
  totalIndexedPages: number;
  totalPages: number;
  progressPercent: number;
  statusMessage: string;
}

/**
 * Checks server cache for existing OCR text for a given document.
 */
export async function fetchServerCachedOcr(
  docKey: string
): Promise<Record<number, { text: string; lines?: any[]; isOcr: boolean }> | null> {
  try {
    const encoded = encodeURIComponent(docKey);
    const res = await fetch(`/api/ocr-document?docKey=${encoded}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.cachedPages && Object.keys(data.cachedPages).length > 0) {
      return data.cachedPages;
    }
    return null;
  } catch (err) {
    console.warn('Could not query server OCR cache:', err);
    return null;
  }
}

/**
 * Renders an offscreen PDF.js page to an optimized JPEG base64 string.
 * Scale 1.25 provides sharp character clarity while keeping payload under ~120KB for fast transfer.
 */
export async function renderPageToImage(page: any, scale: number = 1.25): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Failed to create canvas context for OCR rendering');
  }

  // Clear canvas to white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  // JPEG 0.80 delivers crisp text with fast serialization
  const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  // Release canvas resources immediately
  canvas.width = 0;
  canvas.height = 0;

  return base64;
}

/**
 * Submits an offscreen rendered page to the server OCR pipeline.
 * Server uses Gemini Vision OCR with automatic Tesseract fallback.
 */
export async function requestPageOcr(
  docKey: string,
  pageNum: number,
  imageBase64: string
): Promise<{ text: string; lines?: Array<{ text: string; bbox?: number[] }>; isOcr: boolean }> {
  try {
    const res = await fetch('/api/ocr-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docKey,
        pageNum,
        imageBase64,
        mimeType: 'image/jpeg',
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Server OCR failed with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      text: data.text || '',
      lines: data.lines || [],
      isOcr: true,
    };
  } catch (err) {
    console.error(`OCR request error on page ${pageNum}:`, err);
    return {
      text: '',
      lines: [],
      isOcr: true,
    };
  }
}
