import * as pdfjsLib from 'pdfjs-dist';
import {
  getStoredDocumentIndex,
  saveStoredDocumentIndex,
  getStoredDocumentOcr,
  saveOcrPage,
  StoredPageOcr,
} from './ocrStorage';
import { fetchServerCachedOcr, renderPageToImage, requestPageOcr } from './ocrService';

export interface SearchMatch {
  id: string;
  pageNum: number;
  matchIndexOnPage: number;
  startOffset: number;
  endOffset: number;
  text: string;
  preview: string;
  isOcr?: boolean;
}

export interface PageTextItem {
  str: string;
  start: number;
  end: number;
}

export interface PageTextInfo {
  pageNum: number;
  text: string;
  items: PageTextItem[];
  isOcr?: boolean;
}

export interface CachedDocumentData {
  key: string;
  pageTextMap: Map<number, PageTextInfo>;
  totalPages: number;
  totalCharacters: number;
  isScanned: boolean;
  hasOcrPages: boolean;
  timestamp: number;
}

export interface DocumentTextIndex {
  docKey: string;
  totalPages: number;
  isScanned: boolean;
  hasOcr: boolean;
  pages: Record<number, StoredPageOcr>;
  indexedAt: number;
}

export interface SearchProgressInfo {
  current: number;
  total: number;
  isDone: boolean;
  isOcrActive?: boolean;
  pageInfo?: PageTextInfo;
}

// Global in-memory cache for processed document text
const documentSearchCache = new Map<string, CachedDocumentData>();

/**
 * Normalizes document identification across storage paths, file names, and URLs.
 * Ensures consistent cache hits across desktop, mobile, modals, and reload sessions.
 */
export function getCanonicalCacheKey(storagePath?: string, fileName?: string, url?: string): string {
  if (storagePath && storagePath.trim() && !storagePath.startsWith('blob:')) {
    let clean = storagePath.trim().replace(/^https?:\/\/[^/]+/i, '');
    clean = clean.split('?')[0].split('#')[0].replace(/^\/+/, '');
    if (clean) return clean;
  }
  if (fileName && fileName.trim()) {
    return fileName.trim();
  }
  if (url && url.trim() && !url.startsWith('blob:') && !url.startsWith('data:')) {
    let clean = url.trim().replace(/^https?:\/\/[^/]+/i, '');
    clean = clean.split('?')[0].split('#')[0].replace(/^\/+/, '');
    if (clean) return clean;
  }
  return fileName?.trim() || 'document_pdf';
}

/**
 * Retrieve cached searchable document representation if available.
 */
export function getCachedDocument(key: string): CachedDocumentData | null {
  if (!key) return null;
  const canonicalKey = getCanonicalCacheKey(key);
  return documentSearchCache.get(canonicalKey) || documentSearchCache.get(key) || null;
}

/**
 * Cache searchable document representation to prevent repeated re-extraction.
 */
export function setCachedDocument(key: string, data: CachedDocumentData): void {
  if (!key) return;
  const canonicalKey = getCanonicalCacheKey(key);
  // Keep cache bounded to recent 50 documents
  if (documentSearchCache.size >= 50) {
    const oldestKey = documentSearchCache.keys().next().value;
    if (oldestKey) documentSearchCache.delete(oldestKey);
  }
  documentSearchCache.set(canonicalKey, data);
  if (canonicalKey !== key) {
    documentSearchCache.set(key, data);
  }
}

/**
 * Clear cached document data.
 */
export function clearDocumentCache(key?: string): void {
  if (key) {
    const canonicalKey = getCanonicalCacheKey(key);
    documentSearchCache.delete(canonicalKey);
    documentSearchCache.delete(key);
  } else {
    documentSearchCache.clear();
  }
}

/**
 * Fetches pre-built Searchable Text Index from the server.
 * Returns in ~30-50ms so mobile devices never have to run OCR.
 */
export async function fetchServerDocumentIndex(docKey: string): Promise<DocumentTextIndex | null> {
  try {
    const encoded = encodeURIComponent(docKey);
    const res = await fetch(`/api/document-index?docKey=${encoded}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.index && data.index.pages) {
      return data.index as DocumentTextIndex;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch server document index:', err);
    return null;
  }
}

/**
 * Saves pre-built Searchable Text Index to server persistent storage.
 */
export async function saveDocumentIndexToServer(index: DocumentTextIndex): Promise<boolean> {
  try {
    const res = await fetch('/api/document-index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(index),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save document index to server:', err);
    return false;
  }
}

/**
 * Normalizes unicode ligatures, quotation marks, and hyphens into standard characters.
 */
export function normalizeSearchString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD]/g, '-')
    .replace(/[\u00A0\u200B\uFEFF]/g, ' ');
}

/**
 * Builds a regex pattern that matches a word tolerantly across:
 * - Case insensitivity (e.g. "hypertension" matches "Hypertension")
 * - Hyphenated line breaks (e.g. "hyper-\ntension" or "hyper- \r\ntension" matching "hypertension")
 * - Line breaks inside words without hyphens (e.g. "hyper\ntension")
 * - Hyphens with extra spaces (e.g. "hyper- tension")
 * - Common OCR spacing errors
 */
function buildTolerantWordPattern(word: string): string {
  const normalized = normalizeSearchString(word);
  const chars = Array.from(normalized);
  if (chars.length === 0) return '';

  // Between letters of a word, permit optional hyphens, dashes, line breaks, or intra-word spacing
  const intraWordBreak = '(?:[-\\u00AD‐‑]?\\s*[\\r\\n]+\\s*|[-\\u00AD‐‑]\\s+)?';

  const parts = chars.map(char => {
    // If the character is a hyphen in the user's query, match any dash, space, or newline
    if (char === '-') {
      return '(?:[-\\u00AD‐‑\\s\\r\\n]+)';
    }
    // Escape special regex characters
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  return parts.join(intraWordBreak);
}

/**
 * Creates an exact, case-insensitive, tolerant regex for search queries.
 * Handles:
 * - Case insensitivity (e.g. "hypertension" matches "Hypertension")
 * - Words split across PDF lines with or without hyphens
 * - Extra spaces in query and document
 * - Multiple-word searches across arbitrary whitespace and line breaks
 */
export function createSearchRegex(query: string): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Split query by one or more whitespace characters to handle extra spaces
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Build tolerant patterns for each word
  const wordPatterns = words.map(w => buildTolerantWordPattern(w)).filter(Boolean);
  if (wordPatterns.length === 0) return null;

  // Between words in a multi-word search, match any combination of whitespace, newlines, and hyphens
  const interWordSeparator = '[\\s\\r\\n\\u00A0]+';
  const pattern = wordPatterns.join(interWordSeparator);

  try {
    return new RegExp(pattern, 'gi');
  } catch (err) {
    // Resilient fallback to simple escaped literal matching
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'gi');
  }
}

/**
 * Searches the entire indexed document for exact literal matches across all pages.
 * Case-insensitive, word-bounded, and fast across cached text.
 */
export function searchAcrossDocument(
  query: string,
  pageTextMap: Map<number, PageTextInfo>,
  totalPages: number
): SearchMatch[] {
  const regex = createSearchRegex(query);
  if (!regex) return [];

  const results: SearchMatch[] = [];

  for (let p = 1; p <= totalPages; p++) {
    const pageInfo = pageTextMap.get(p);
    if (!pageInfo || !pageInfo.text) continue;

    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    let matchIdx = 0;

    while ((m = regex.exec(pageInfo.text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;

      // Extract contextual preview (35 chars before and after)
      const prevStart = Math.max(0, start - 35);
      const nextEnd = Math.min(pageInfo.text.length, end + 35);
      const preview = pageInfo.text.slice(prevStart, nextEnd).replace(/\s+/g, ' ');

      results.push({
        id: `p${p}-m${matchIdx}`,
        pageNum: p,
        matchIndexOnPage: matchIdx,
        startOffset: start,
        endOffset: end,
        text: m[0],
        preview,
        isOcr: !!pageInfo.isOcr,
      });

      matchIdx++;

      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  }

  return results;
}

/**
 * Extracts and caches searchable text for all PDF pages.
 * Handles:
 * 1. Vector/selectable text PDFs (instant extraction)
 * 2. Scanned image-based PDFs (via automatic server OCR once)
 * 3. Mixed PDFs (native text where available, OCR for scanned pages)
 * Stores full index in server persistent storage, IndexedDB, and memory cache.
 */
export async function extractDocumentText(
  pdfDoc: any,
  rawCacheKey: string,
  onProgress?: (info: SearchProgressInfo) => void
): Promise<CachedDocumentData> {
  const numPages = pdfDoc.numPages;
  const cacheKey = getCanonicalCacheKey(rawCacheKey);

  // 1. Check in-memory cache
  const memoryCached = getCachedDocument(cacheKey);
  if (memoryCached && memoryCached.pageTextMap.size >= numPages) {
    onProgress?.({
      current: numPages,
      total: numPages,
      isDone: true,
    });
    return memoryCached;
  }

  const pageTextMap = new Map<number, PageTextInfo>();
  let totalCharacters = 0;

  // Populate from in-memory cache if partial
  if (memoryCached) {
    for (const [pNum, pInfo] of memoryCached.pageTextMap.entries()) {
      if (pNum >= 1 && pNum <= numPages && pInfo.text) {
        pageTextMap.set(pNum, pInfo);
        totalCharacters += pInfo.text.trim().length;
      }
    }
  }

  // 2. Check server-side full document index FIRST (one fast <50ms HTTP request for mobile/tablet/desktop)
  if (pageTextMap.size < numPages) {
    const serverIndex = await fetchServerDocumentIndex(cacheKey).catch(() => null);
    if (serverIndex && serverIndex.pages && Object.keys(serverIndex.pages).length > 0) {
      for (const [pStr, rawData] of Object.entries(serverIndex.pages)) {
        const pNum = Number(pStr);
        const pData = rawData as StoredPageOcr | undefined;
        if (pNum >= 1 && pNum <= numPages && pData && typeof pData.text === 'string') {
          const info: PageTextInfo = {
            pageNum: pNum,
            text: pData.text,
            items: [],
            isOcr: !!pData.isOcr,
          };
          pageTextMap.set(pNum, info);
          totalCharacters += pData.text.trim().length;
        }
      }

      if (pageTextMap.size >= numPages) {
        const cachedData: CachedDocumentData = {
          key: cacheKey,
          pageTextMap,
          totalPages: numPages,
          totalCharacters,
          isScanned: !!serverIndex.isScanned,
          hasOcrPages: !!serverIndex.hasOcr,
          timestamp: serverIndex.indexedAt || Date.now(),
        };
        setCachedDocument(cacheKey, cachedData);
        // Also save to client IndexedDB for instant offline lookups
        saveStoredDocumentIndex({
          docKey: cacheKey,
          totalPages: numPages,
          pages: serverIndex.pages,
          indexedAt: Date.now(),
          isComplete: true,
        }).catch(() => {});
        onProgress?.({
          current: numPages,
          total: numPages,
          isDone: true,
        });
        return cachedData;
      }
    }
  }

  // 3. Check client-side persistent IndexedDB storage
  if (pageTextMap.size < numPages) {
    const idbIndex = await getStoredDocumentIndex(cacheKey).catch(() => null);
    if (idbIndex && idbIndex.pages) {
      for (const [pStr, val] of Object.entries(idbIndex.pages)) {
        const pData = val as { text?: string; isOcr?: boolean };
        const pNum = Number(pStr);
        if (!pageTextMap.has(pNum) && pNum >= 1 && pNum <= numPages && pData.text) {
          const info: PageTextInfo = {
            pageNum: pNum,
            text: pData.text,
            items: [],
            isOcr: pData.isOcr ?? false,
          };
          pageTextMap.set(pNum, info);
          totalCharacters += pData.text.trim().length;
        }
      }
      if (pageTextMap.size >= numPages) {
        const cachedData: CachedDocumentData = {
          key: cacheKey,
          pageTextMap,
          totalPages: numPages,
          totalCharacters,
          isScanned: false,
          hasOcrPages: Array.from(pageTextMap.values()).some(p => p.isOcr),
          timestamp: idbIndex.indexedAt || Date.now(),
        };
        setCachedDocument(cacheKey, cachedData);
        onProgress?.({
          current: numPages,
          total: numPages,
          isDone: true,
        });
        return cachedData;
      }
    }

    // Fallback: check individual page OCR cache
    const idbCached = await getStoredDocumentOcr(cacheKey).catch(() => null);
    if (idbCached) {
      for (const [pStr, val] of Object.entries(idbCached)) {
        const pData = val as { text?: string; isOcr?: boolean };
        const pNum = Number(pStr);
        if (!pageTextMap.has(pNum) && pNum >= 1 && pNum <= numPages && pData.text) {
          const info: PageTextInfo = {
            pageNum: pNum,
            text: pData.text,
            items: [],
            isOcr: pData.isOcr ?? true,
          };
          pageTextMap.set(pNum, info);
          totalCharacters += pData.text.trim().length;
        }
      }
    }
  }

  // 4. Check server-side OCR disk cache for any individual cached pages
  if (pageTextMap.size < numPages) {
    const serverCached = await fetchServerCachedOcr(cacheKey).catch(() => null);
    if (serverCached) {
      for (const [pStr, val] of Object.entries(serverCached)) {
        const pData = val as { text?: string; isOcr?: boolean };
        const pNum = Number(pStr);
        if (!pageTextMap.has(pNum) && pNum >= 1 && pNum <= numPages && pData.text) {
          const info: PageTextInfo = {
            pageNum: pNum,
            text: pData.text,
            items: [],
            isOcr: true,
          };
          pageTextMap.set(pNum, info);
          totalCharacters += pData.text.trim().length;
          saveOcrPage(cacheKey, pNum, { text: pData.text, isOcr: true }, numPages).catch(() => {});
        }
      }
    }
  }

  // If all pages were already indexed: return immediately!
  if (pageTextMap.size >= numPages) {
    const cachedData: CachedDocumentData = {
      key: cacheKey,
      pageTextMap,
      totalPages: numPages,
      totalCharacters,
      isScanned: false,
      hasOcrPages: Array.from(pageTextMap.values()).some(p => p.isOcr),
      timestamp: Date.now(),
    };
    setCachedDocument(cacheKey, cachedData);
    onProgress?.({
      current: numPages,
      total: numPages,
      isDone: true,
    });
    return cachedData;
  }

  // 5. Inspect remaining pages for native selectable text (fast token extraction, <200ms)
  const pagesNeedingOcr: number[] = [];

  for (let p = 1; p <= numPages; p++) {
    if (pageTextMap.has(p)) continue;

    try {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();

      let pageText = '';
      const items: PageTextItem[] = [];

      for (let i = 0; i < textContent.items.length; i++) {
        const item = textContent.items[i] as any;
        if (!item || typeof item.str !== 'string') continue;
        const str = item.str;

        if (pageText.length > 0) {
          const prevChar = pageText[pageText.length - 1];
          const firstChar = str[0];
          const hasSpace = /\s/.test(prevChar) || (firstChar && /\s/.test(firstChar));
          if (!hasSpace) {
            if (item.hasEOL) {
              pageText += '\n';
            } else {
              pageText += ' ';
            }
          }
        }

        const start = pageText.length;
        pageText += str;
        items.push({ str, start, end: start + str.length });
        if (item.hasEOL && !pageText.endsWith('\n')) {
          pageText += '\n';
        }
      }

      const cleanText = pageText.trim();
      // If page has sufficient characters (>= 15), it is selectable vector text
      if (cleanText.length >= 15) {
        totalCharacters += cleanText.length;
        const pageInfo: PageTextInfo = { pageNum: p, text: pageText, items, isOcr: false };
        pageTextMap.set(p, pageInfo);
        onProgress?.({
          current: pageTextMap.size,
          total: numPages,
          isDone: false,
          pageInfo,
        });
      } else {
        pagesNeedingOcr.push(p);
      }
    } catch (err) {
      console.warn(`Could not extract native text from page ${p}:`, err);
      pagesNeedingOcr.push(p);
    }
  }

  // 6. Perform OCR only once for scanned pages that lack selectable text
  const hasOcrPages = pagesNeedingOcr.length > 0;
  if (pagesNeedingOcr.length > 0) {
    const CONCURRENCY = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < pagesNeedingOcr.length) {
        const currentIdx = nextIndex++;
        const p = pagesNeedingOcr[currentIdx];

        if (pageTextMap.has(p) && pageTextMap.get(p)!.text) continue;

        try {
          const page = await pdfDoc.getPage(p);
          const imageBase64 = await renderPageToImage(page, 1.25);
          const ocrResult = await requestPageOcr(cacheKey, p, imageBase64);

          const recognizedText = ocrResult.text || '';
          totalCharacters += recognizedText.trim().length;

          const pageInfo: PageTextInfo = {
            pageNum: p,
            text: recognizedText,
            items: [],
            isOcr: true,
          };

          pageTextMap.set(p, pageInfo);
          saveOcrPage(cacheKey, p, { text: recognizedText, isOcr: true }, numPages).catch(() => {});

          onProgress?.({
            current: pageTextMap.size,
            total: numPages,
            isDone: false,
            isOcrActive: true,
            pageInfo,
          });
        } catch (ocrErr) {
          console.warn(`OCR failed on page ${p}:`, ocrErr);
          const pageInfo: PageTextInfo = { pageNum: p, text: '', items: [], isOcr: true };
          pageTextMap.set(p, pageInfo);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, pagesNeedingOcr.length) },
      () => worker()
    );
    await Promise.all(workers);
  }

  const isScanned = pagesNeedingOcr.length === numPages && totalCharacters > 0;

  const cachedData: CachedDocumentData = {
    key: cacheKey,
    pageTextMap,
    totalPages: numPages,
    totalCharacters,
    isScanned,
    hasOcrPages,
    timestamp: Date.now(),
  };

  setCachedDocument(cacheKey, cachedData);

  // Assemble and persist full DocumentTextIndex to server and IndexedDB
  const pagesObj: Record<number, StoredPageOcr> = {};
  for (const [pNum, pInfo] of pageTextMap.entries()) {
    pagesObj[pNum] = {
      pageNum: pNum,
      text: pInfo.text,
      isOcr: !!pInfo.isOcr,
    };
  }

  const documentIndex: DocumentTextIndex = {
    docKey: cacheKey,
    totalPages: numPages,
    isScanned,
    hasOcr: hasOcrPages,
    pages: pagesObj,
    indexedAt: Date.now(),
  };

  saveDocumentIndexToServer(documentIndex).catch(() => {});
  saveStoredDocumentIndex({
    docKey: cacheKey,
    totalPages: numPages,
    pages: pagesObj,
    indexedAt: Date.now(),
    isComplete: true,
  }).catch(() => {});

  onProgress?.({
    current: numPages,
    total: numPages,
    isDone: true,
    isOcrActive: false,
  });

  return cachedData;
}

/**
 * Indexes an uploaded PDF document once and saves its searchable text index permanently
 * to the server and client IndexedDB so no device ever runs OCR during search.
 */
export async function indexAndSaveUploadedDocument(
  file: File,
  storagePath: string,
  fileName: string
): Promise<CachedDocumentData | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const cacheKey = getCanonicalCacheKey(storagePath, fileName);
    return await extractDocumentText(pdfDoc, cacheKey);
  } catch (err) {
    console.warn('Indexing notice:', err);
    return null;
  }
}

/**
 * Pre-indexes an uploaded document in the background to build its search index upfront.
 * If the document is scanned, OCR is generated and stored in server disk cache and IndexedDB.
 */
export async function preIndexUploadedDocument(
  file: File,
  storagePath: string,
  fileName: string
): Promise<void> {
  await indexAndSaveUploadedDocument(file, storagePath, fileName);
}

/**
 * Smoothly scrolls an element into view INSIDE its parent .pdf-scroll-container,
 * ensuring the main browser window / website never scrolls or jumps.
 */
export function scrollElementWithinPdfContainer(
  element: HTMLElement | null,
  options: { align?: 'start' | 'center'; padding?: number } = {}
): void {
  if (!element) return;

  const scrollContainer = element.closest('.pdf-scroll-container') as HTMLElement | null;
  if (!scrollContainer) return;

  const { align = 'center', padding = 20 } = options;
  const containerRect = scrollContainer.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();

  // Position of element relative to scrollContainer's internal scroll coordinates
  const relativeTop = elRect.top - containerRect.top + scrollContainer.scrollTop;

  let targetTop: number;
  if (align === 'start') {
    targetTop = relativeTop - padding;
  } else {
    targetTop = relativeTop - containerRect.height / 2 + elRect.height / 2;
  }

  // Handle horizontal scrolling if page is zoomed
  let targetLeft = scrollContainer.scrollLeft;
  if (elRect.left < containerRect.left || elRect.right > containerRect.right) {
    const relativeLeft = elRect.left - containerRect.left + scrollContainer.scrollLeft;
    targetLeft = relativeLeft - containerRect.width / 2 + elRect.width / 2;
  }

  scrollContainer.scrollTo({
    top: Math.max(0, targetTop),
    left: Math.max(0, targetLeft),
    behavior: 'smooth',
  });
}

/**
 * Restores original text in highlighted spans without destroying the PDF.js text layer layout.
 */
export function clearSearchHighlights(container: HTMLElement | null): void {
  if (!container) return;
  const matchSpans = container.querySelectorAll('.pdf-search-match');
  if (matchSpans.length === 0) return;

  matchSpans.forEach(m => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent || ''), m);
      parent.normalize();
    }
  });
}

export interface HighlightRect {
  id: string;
  matchId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Detects if the current client is a mobile phone or tablet device.
 * Accurately covers iPhone, Android phones, iPad (including iPadOS Safari desktop mode),
 * Android tablets, and touch-screen mobile devices.
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  // Mobile / tablet user agent signatures
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);

  // iPadOS Safari reports as Macintosh with multi-touch points
  const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
  const isIPadOS = hasTouch && /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;

  // Viewport width check (< 1024px is standard tablet/mobile breakpoint)
  const isSmallScreen = window.innerWidth < 1024;


  return isMobileUA || isIPadOS || (hasTouch && isSmallScreen);
}

/**
 * Lightweight, dedicated search-word highlight calculator specifically for mobile & tablet devices.
 * - Inspects ONLY the existing text layer DOM for this ONE page
 * - Finds the exact searched word/phrase (including across adjacent spans)
 * - Computes position from existing text-layer DOM in < 0.2ms
 * - Produces ONE simple orange highlight overlay directly over the word/phrase
 * - Zero OCR, zero full-document processing, zero scroll overhead
 */
export function computeMobileSingleMatchHighlight(
  container: HTMLElement | null,
  pageNumOrMatch: number | SearchMatch,
  pageMatchesOrTerm: SearchMatch[] | string,
  selectedMatchOrPageSize: SearchMatch | { width: number; height: number },
  searchTermOpt?: string,
  pageSizeOpt?: { width: number; height: number }
): HighlightRect[] {
  if (!container) return [];

  // Normalize parameters
  let targetMatch: SearchMatch | null = null;
  let term = '';
  let pageSize = { width: 800, height: 1100 };

  if (typeof pageNumOrMatch === 'number') {
    targetMatch = (selectedMatchOrPageSize as SearchMatch) || null;
    term = (searchTermOpt || '').trim();
    if (pageSizeOpt) pageSize = pageSizeOpt;
  } else {
    targetMatch = pageNumOrMatch as SearchMatch;
    term = (typeof pageMatchesOrTerm === 'string' ? pageMatchesOrTerm : '').trim();
    if (selectedMatchOrPageSize && 'width' in selectedMatchOrPageSize) {
      pageSize = selectedMatchOrPageSize as { width: number; height: number };
    }
  }

  if (!targetMatch || !term) return [];

  // Collect existing spans from this page's text layer
  const spans = Array.from(
    container.querySelectorAll('span:not(.pdf-search-match)')
  ) as HTMLElement[];
  if (spans.length === 0) return [];

  const containerRect = container.getBoundingClientRect();
  const targetMatchIndex = targetMatch.matchIndexOnPage ?? 0;
  const queryLower = term.toLowerCase();

  // Helper to compute element relative bounding box
  const getRelativeBox = (el: HTMLElement) => {
    const eRect = el.getBoundingClientRect();
    if (containerRect.width > 0 && eRect.width > 0) {
      return {
        left: Math.round(eRect.left - containerRect.left),
        top: Math.round(eRect.top - containerRect.top),
        width: Math.round(eRect.width),
        height: Math.round(eRect.height),
      };
    }
    return {
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth || parseFloat(el.style.width) || 60,
      height: el.offsetHeight || parseFloat(el.style.height) || 18,
    };
  };

  // Helper to compute sub-string range bounding box
  const getSubStringBoxes = (
    span: HTMLElement,
    startChar: number,
    endChar: number
  ): Array<{ left: number; top: number; width: number; height: number }> => {
    // Try Range for sub-pixel character accuracy
    if (span.firstChild && span.firstChild.nodeType === Node.TEXT_NODE && containerRect.width > 0) {
      try {
        const textNode = span.firstChild as Text;
        const textLen = textNode.nodeValue?.length || span.textContent?.length || 0;
        const s = Math.max(0, Math.min(startChar, textLen));
        const e = Math.max(s, Math.min(endChar, textLen));
        if (e > s) {
          const range = document.createRange();
          range.setStart(textNode, s);
          range.setEnd(textNode, e);
          const clientRects = range.getClientRects();
          if (clientRects.length > 0 && clientRects[0].width > 0.5) {
            const result = [];
            for (let i = 0; i < clientRects.length; i++) {
              const cr = clientRects[i];
              if (cr.width > 0.5 && cr.height > 0.5) {
                result.push({
                  left: Math.round(cr.left - containerRect.left),
                  top: Math.round(cr.top - containerRect.top),
                  width: Math.max(8, Math.round(cr.width)),
                  height: Math.max(12, Math.round(cr.height)),
                });
              }
            }
            if (result.length > 0) return result;
          }
        }
      } catch {}
    }

    // Proportional fallback (reliable across all mobile browsers and zoom states)
    const spanBox = getRelativeBox(span);
    const fullLen = Math.max(1, span.textContent?.length || 1);
    const sFrac = Math.max(0, startChar) / fullLen;
    const eFrac = Math.min(fullLen, endChar) / fullLen;
    return [{
      left: Math.round(spanBox.left + spanBox.width * sFrac),
      top: spanBox.top,
      width: Math.max(8, Math.round(spanBox.width * (eFrac - sFrac))),
      height: Math.max(12, spanBox.height),
    }];
  };

  // STEP 1: Fast direct single-span exact matching (most common case, e.g. "hypertension")
  const directMatches: Array<{ span: HTMLElement; start: number; end: number }> = [];
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const text = span.textContent || '';
    if (!text) continue;
    const textLower = text.toLowerCase();
    let idx = textLower.indexOf(queryLower);
    while (idx !== -1) {
      directMatches.push({
        span,
        start: idx,
        end: idx + term.length,
      });
      idx = textLower.indexOf(queryLower, idx + 1);
    }
  }

  if (directMatches.length > 0) {
    const chosenIdx = Math.min(targetMatchIndex, directMatches.length - 1);
    const match = directMatches[chosenIdx];
    const subBoxes = getSubStringBoxes(match.span, match.start, match.end);
    return subBoxes.map((b, bIdx) => ({
      id: `${targetMatch!.id}-m-box-${bIdx}`,
      matchId: targetMatch!.id,
      left: b.left,
      top: b.top,
      width: b.width,
      height: b.height,
    }));
  }

  // STEP 2: Multi-span matching (handles words or phrases split across adjacent PDF.js spans)
  interface SpanToken {
    span: HTMLElement;
    text: string;
    start: number;
    end: number;
  }
  const spanTokens: SpanToken[] = [];
  let concatenated = '';

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const text = span.textContent || '';
    if (!text) continue;

    const start = concatenated.length;
    concatenated += text;
    const end = concatenated.length;

    spanTokens.push({ span, text, start, end });
  }

  const concatLower = concatenated.toLowerCase();
  const multiMatches: Array<{ start: number; end: number }> = [];
  let mIdx = concatLower.indexOf(queryLower);
  while (mIdx !== -1) {
    multiMatches.push({
      start: mIdx,
      end: mIdx + term.length,
    });
    mIdx = concatLower.indexOf(queryLower, mIdx + 1);
  }

  // If not found with direct concatenation, try regex which handles flexible whitespace between spans
  if (multiMatches.length === 0) {
    const normRegex = createSearchRegex(term);
    if (normRegex) {
      let rMatch: RegExpExecArray | null;
      while ((rMatch = normRegex.exec(concatenated)) !== null) {
        multiMatches.push({
          start: rMatch.index,
          end: rMatch.index + rMatch[0].length,
        });
        if (rMatch.index === normRegex.lastIndex) normRegex.lastIndex++;
      }
    }
  }

  if (multiMatches.length > 0) {
    const chosenIdx = Math.min(targetMatchIndex, multiMatches.length - 1);
    const targetRange = multiMatches[chosenIdx];
    const matchingSpans = spanTokens.filter(
      t => t.end > targetRange.start && t.start < targetRange.end
    );

    const boxes: HighlightRect[] = [];
    for (const t of matchingSpans) {
      const inSpanStart = Math.max(0, targetRange.start - t.start);
      const inSpanEnd = Math.min(t.text.length, targetRange.end - t.start);
      if (inSpanEnd > inSpanStart) {
        const subBoxes = getSubStringBoxes(t.span, inSpanStart, inSpanEnd);
        for (let b = 0; b < subBoxes.length; b++) {
          boxes.push({
            id: `${targetMatch.id}-m-box-${boxes.length}`,
            matchId: targetMatch.id,
            left: subBoxes[b].left,
            top: subBoxes[b].top,
            width: subBoxes[b].width,
            height: subBoxes[b].height,
          });
        }
      }
    }

    if (boxes.length > 0) {
      return boxes;
    }
  }

  // STEP 3: Fallback - locate closest span matching snippet or primary search word
  const termWords = term.split(/\s+/).filter(w => w.length > 2);
  for (const word of termWords) {
    const wordLower = word.toLowerCase();
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const text = span.textContent || '';
      const wIdx = text.toLowerCase().indexOf(wordLower);
      if (wIdx !== -1) {
        const subBoxes = getSubStringBoxes(span, wIdx, wIdx + word.length);
        return subBoxes.map((b, bIdx) => ({
          id: `${targetMatch!.id}-m-fallback-${bIdx}`,
          matchId: targetMatch!.id,
          left: b.left,
          top: b.top,
          width: b.width,
          height: b.height,
        }));
      }
    }
  }

  return [];
}

/**
 * Computes exact pixel coordinates for visual search highlights over the PDF page.
 * Maps search results to corresponding coordinates from either native PDF.js text layer
 * or OCR-generated text layer spans without mutating or breaking the underlying text.
 * If targetMatchId is supplied (e.g. mobile/tablet single-match mode), only computes
 * bounding boxes for that specific match, avoiding any unnecessary DOM operations.
 */
export function computePageHighlightBoxes(
  container: HTMLElement | null,
  pageNum: number,
  pageMatches: SearchMatch[],
  query: string,
  pageSize: { width: number; height: number },
  targetMatchId?: string | null
): HighlightRect[] {
  if (!container) return [];
  const trimmed = query.trim();
  if (!trimmed || pageMatches.length === 0) return [];

  // If mobile target match was specified, ensure it actually belongs to this page
  if (targetMatchId && !pageMatches.some(m => m.id === targetMatchId)) {
    return [];
  }

  const regex = createSearchRegex(trimmed);
  if (!regex) return [];

  const containerRect = container.getBoundingClientRect();
  const cWidth = containerRect.width > 0 ? containerRect.width : pageSize.width;
  const cHeight = containerRect.height > 0 ? containerRect.height : pageSize.height;

  // Collect text spans rendered by PDF.js TextLayer or OCR injection
  const spans = Array.from(container.querySelectorAll('span')) as HTMLElement[];
  if (spans.length === 0) return [];

  interface DomTextChunk {
    span: HTMLElement;
    node: Text | null;
    text: string;
    start: number;
    end: number;
  }

  const chunks: DomTextChunk[] = [];
  let fullText = '';

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    // Ignore internal highlight helper spans if any exist
    if (span.classList.contains('pdf-search-match')) continue;

    const text = span.textContent || '';
    if (!text) continue;

    if (fullText.length > 0) {
      const prevChar = fullText[fullText.length - 1];
      const firstChar = text[0];
      const hasSpace = /\s/.test(prevChar) || (firstChar && /\s/.test(firstChar));
      if (!hasSpace) {
        fullText += ' ';
      }
    }

    // Find the first text node in the span
    let textNode: Text | null = null;
    for (let c = 0; c < span.childNodes.length; c++) {
      if (span.childNodes[c].nodeType === Node.TEXT_NODE) {
        textNode = span.childNodes[c] as Text;
        break;
      }
    }

    const start = fullText.length;
    fullText += text;
    chunks.push({
      span,
      node: textNode,
      text,
      start,
      end: start + text.length,
    });
  }

  // Find occurrences of query in this page's text
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  let matchIdx = 0;
  const occurrences: Array<{
    matchId: string;
    start: number;
    end: number;
    text: string;
  }> = [];

  while ((m = regex.exec(fullText)) !== null) {
    const matchId = pageMatches[matchIdx]?.id || `p${pageNum}-m${matchIdx}`;
    occurrences.push({
      matchId,
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
    });
    matchIdx++;
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  // Fallback to pageMatches offsets if fullText regex didn't find them (e.g. OCR spacing edge cases)
  if (occurrences.length === 0) {
    for (let i = 0; i < pageMatches.length; i++) {
      const pm = pageMatches[i];
      occurrences.push({
        matchId: pm.id,
        start: pm.startOffset,
        end: pm.endOffset,
        text: pm.text,
      });
    }
  }

  // Filter to single target match if requested (Mobile/tablet on-demand mode)
  let targetOccurrences = targetMatchId
    ? occurrences.filter(occ => occ.matchId === targetMatchId)
    : occurrences;

  // If specific target match was not matched by matchId, match by matchIndexOnPage or fallback
  if (targetMatchId && targetOccurrences.length === 0) {
    const targetMatch = pageMatches.find(pm => pm.id === targetMatchId);
    if (targetMatch && occurrences.length > 0) {
      const occIdx = Math.min(targetMatch.matchIndexOnPage, occurrences.length - 1);
      targetOccurrences = [{
        ...occurrences[occIdx],
        matchId: targetMatchId,
      }];
    } else if (targetMatch) {
      targetOccurrences = [{
        matchId: targetMatch.id,
        start: targetMatch.startOffset,
        end: targetMatch.endOffset,
        text: targetMatch.text,
      }];
    }
  }

  const finalOccurrences = targetOccurrences;
  const highlightBoxes: HighlightRect[] = [];

  for (const match of finalOccurrences) {
    let overlapping = chunks.filter(c => c.end > match.start && c.start < match.end);

    // Resilient fallback: locate chunk containing query text if offsets shifted slightly
    if (overlapping.length === 0 && chunks.length > 0) {
      const queryLower = trimmed.toLowerCase();
      const directChunk = chunks.find(c => c.text.toLowerCase().includes(queryLower));
      if (directChunk) {
        overlapping = [directChunk];
      }
    }

    if (overlapping.length === 0) continue;

    for (const chunk of overlapping) {
      const inChunkStart = Math.max(0, match.start - chunk.start);
      const inChunkEnd = Math.min(chunk.text.length, match.end - chunk.start);
      if (inChunkEnd <= inChunkStart) continue;

      let rectAdded = false;

      // Approach 1: Precise DOM Range getClientRects on the Text node
      if (chunk.node && containerRect.width > 0) {
        try {
          const range = document.createRange();
          const nodeLen = chunk.node.nodeValue?.length || chunk.text.length;
          const safeStart = Math.min(inChunkStart, nodeLen);
          const safeEnd = Math.min(inChunkEnd, nodeLen);

          if (safeEnd > safeStart) {
            range.setStart(chunk.node, safeStart);
            range.setEnd(chunk.node, safeEnd);

            const clientRects = range.getClientRects();
            for (let r = 0; r < clientRects.length; r++) {
              const cr = clientRects[r];
              if (cr.width > 0.5 && cr.height > 0.5) {
                const boxLeft = Math.round(cr.left - containerRect.left);
                const boxTop = Math.round(cr.top - containerRect.top);
                const boxWidth = Math.round(cr.width);
                const boxHeight = Math.round(cr.height);

                highlightBoxes.push({
                  id: `${match.matchId}-box-${highlightBoxes.length}`,
                  matchId: match.matchId,
                  left: boxLeft,
                  top: boxTop,
                  width: Math.max(8, boxWidth),
                  height: Math.max(8, boxHeight),
                });
                rectAdded = true;
              }
            }
          }
        } catch {
          // Fall back to span-based coordinate computation
        }
      }

      // Approach 2: Proportional element coordinate calculation (for OCR text spans or when Range returns 0 rects)
      if (!rectAdded) {
        const span = chunk.span;
        const spanRect = span.getBoundingClientRect();

        let sLeft: number;
        let sTop: number;
        let sWidth: number;
        let sHeight: number;

        if (containerRect.width > 0 && spanRect.width > 0) {
          sLeft = spanRect.left - containerRect.left;
          sTop = spanRect.top - containerRect.top;
          sWidth = spanRect.width;
          sHeight = spanRect.height;
        } else {
          sLeft = span.offsetLeft;
          sTop = span.offsetTop;
          sWidth = span.offsetWidth;
          sHeight = span.offsetHeight;
        }

        // Support percentage-based inline styles from injectOcrSpansIntoTextLayer
        if (sWidth <= 0 && span.style.width) {
          if (span.style.width.endsWith('%')) {
            sWidth = (parseFloat(span.style.width) / 100) * cWidth;
          } else {
            sWidth = parseFloat(span.style.width) || 0;
          }
        }
        if (sTop <= 0 && span.style.top) {
          sTop = parseFloat(span.style.top) || 0;
        }
        if (sLeft <= 0 && span.style.left) {
          if (span.style.left.endsWith('%')) {
            sLeft = (parseFloat(span.style.left) / 100) * cWidth;
          } else {
            sLeft = parseFloat(span.style.left) || 0;
          }
        }
        if (sHeight <= 0) {
          sHeight = parseFloat(span.style.lineHeight) || parseFloat(span.style.fontSize) || 18;
        }

        const charCount = Math.max(1, chunk.text.length);
        const startFrac = inChunkStart / charCount;
        const endFrac = inChunkEnd / charCount;

        const boxLeft = Math.round(sLeft + sWidth * startFrac);
        const boxWidth = Math.max(10, Math.round(sWidth * (endFrac - startFrac)));
        const boxTop = Math.round(sTop);
        const boxHeight = Math.max(10, Math.round(sHeight));

        highlightBoxes.push({
          id: `${match.matchId}-box-${highlightBoxes.length}`,
          matchId: match.matchId,
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
        });
      }
    }
  }

  return highlightBoxes;
}

/**
 * Accurately highlights exact search matches inside the PDF.js text layer on a rendered page.
 * Uses exact text-based matching directly on the rendered DOM text elements.
 * Preserves text selection, typography, and respects whole-word boundaries.
 */
export function applySearchHighlights(
  container: HTMLElement | null,
  pageNum: number,
  pageMatches: SearchMatch[],
  selectedMatchId: string | null,
  query: string
): void {
  if (!container) return;

  // Always clear any existing highlights first
  clearSearchHighlights(container);

  const trimmed = query.trim();
  if (!trimmed || pageMatches.length === 0) {
    return;
  }

  const regex = createSearchRegex(trimmed);
  if (!regex) return;

  // Collect text spans rendered by PDF.js TextLayer (direct children or presentation spans)
  const spans = Array.from(container.querySelectorAll('span:not(.pdf-search-match)')) as HTMLElement[];
  if (spans.length === 0) return;

  // Map DOM spans to continuous character offsets
  let fullText = '';
  const spanMappings: Array<{
    span: HTMLElement;
    text: string;
    start: number;
    end: number;
  }> = [];

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const text = span.textContent || '';
    if (!text) continue;

    if (fullText.length > 0) {
      const prevChar = fullText[fullText.length - 1];
      const firstChar = text[0];
      const hasSpace = /\s/.test(prevChar) || (firstChar && /\s/.test(firstChar));
      if (!hasSpace) {
        fullText += ' ';
      }
    }

    const start = fullText.length;
    fullText += text;
    spanMappings.push({
      span,
      text,
      start,
      end: start + text.length,
    });
  }

  // Find exact literal matches in this page's DOM text
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  let matchIdx = 0;
  const domMatches: Array<{
    id: string;
    start: number;
    end: number;
    text: string;
  }> = [];

  while ((m = regex.exec(fullText)) !== null) {
    domMatches.push({
      id: `p${pageNum}-m${matchIdx}`,
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
    });
    matchIdx++;
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  // Highlight only the exact matched substrings in overlapping spans
  for (const mapping of spanMappings) {
    const { span, text, start: spanStart, end: spanEnd } = mapping;
    const overlapping = domMatches.filter(dm => dm.start < spanEnd && dm.end > spanStart);
    if (overlapping.length === 0) continue;

    overlapping.sort((a, b) => a.start - b.start);

    span.innerHTML = '';
    let cursor = spanStart;

    for (const match of overlapping) {
      const matchStart = Math.max(match.start, spanStart);
      const matchEnd = Math.min(match.end, spanEnd);

      // Text chunk before match
      if (matchStart > cursor) {
        const textBefore = text.substring(cursor - spanStart, matchStart - spanStart);
        span.appendChild(document.createTextNode(textBefore));
      }

      // Matched text chunk
      if (matchEnd > matchStart) {
        const matchedSubstring = text.substring(matchStart - spanStart, matchEnd - spanStart);
        const matchSpan = document.createElement('span');
        const isSelected = match.id === selectedMatchId;
        matchSpan.className = isSelected
          ? 'pdf-search-match pdf-search-match-selected'
          : 'pdf-search-match';
        matchSpan.dataset.matchId = match.id;
        matchSpan.textContent = matchedSubstring;
        span.appendChild(matchSpan);
      }

      cursor = Math.max(cursor, matchEnd);
    }

    // Trailing text chunk after all matches in this span
    if (cursor < spanEnd) {
      const textAfter = text.substring(cursor - spanStart);
      span.appendChild(document.createTextNode(textAfter));
    }
  }

  // Scroll active match into center view INSIDE the PDF scroll container
  if (selectedMatchId) {
    const activeEl = container.querySelector(`[data-match-id="${selectedMatchId}"]`) as HTMLElement;
    if (activeEl) {
      scrollElementWithinPdfContainer(activeEl, { align: 'center' });
    }
  }
}

/**
 * Fast-updates the selected match highlight class on an already highlighted page
 * without re-parsing or recreating DOM nodes.
 */
export function updateSelectedHighlight(
  container: HTMLElement | null,
  selectedMatchId: string | null
): void {
  if (!container) return;

  // Remove existing selection highlights
  const previousSelected = container.querySelectorAll('.pdf-search-match-selected');
  previousSelected.forEach(el => {
    el.classList.remove('pdf-search-match-selected');
  });

  if (!selectedMatchId) return;

  // Add selected highlight to current match
  const newSelected = container.querySelectorAll(`[data-match-id="${selectedMatchId}"]`);
  newSelected.forEach(el => {
    el.classList.add('pdf-search-match-selected');
  });

  if (newSelected.length > 0) {
    scrollElementWithinPdfContainer(newSelected[0] as HTMLElement, { align: 'center' });
  }
}

/**
 * Injects OCR text into the page's TextLayer container for scanned pages.
 * Spans are rendered with transparent color and user-select: text so users can select
 * text while exact search match highlights are accurately placed and visually emphasized.
 */
export function injectOcrSpansIntoTextLayer(
  container: HTMLElement | null,
  ocrText: string,
  viewport: { width: number; height: number }
): void {
  if (!container || !ocrText) return;
  container.innerHTML = '';

  const lines = ocrText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return;

  const totalLines = lines.length;
  const pageHeight = viewport.height;
  const lineHeight = Math.max(16, Math.min(30, (pageHeight * 0.88) / Math.max(1, totalLines)));

  lines.forEach((line, idx) => {
    const span = document.createElement('span');
    span.textContent = line;
    span.className = 'ocr-text-line';
    span.style.position = 'absolute';
    span.style.left = '5%';
    span.style.width = '90%';
    span.style.top = `${Math.min(pageHeight - 20, 20 + idx * lineHeight)}px`;
    span.style.fontSize = `${Math.max(11, Math.min(16, lineHeight * 0.72))}px`;
    span.style.lineHeight = `${lineHeight}px`;
    span.style.color = 'transparent';
    span.style.userSelect = 'text';
    span.style.pointerEvents = 'auto';
    span.style.whiteSpace = 'pre-wrap';
    span.style.wordBreak = 'break-word';
    container.appendChild(span);
  });
}

