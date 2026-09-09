/**
 * Client-Side Persistent IndexedDB Storage for PDF OCR Text Layers.
 * 
 * Ensures that once a scanned or mixed PDF has been OCR-indexed,
 * its text layer persists across page navigations, browser restarts,
 * and mobile tab switches without re-running OCR.
 */

const DB_NAME = 'maltese_pdf_ocr_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'ocr_documents';

export interface StoredPageOcr {
  pageNum: number;
  text: string;
  lines?: Array<{ text: string; bbox?: number[] }>;
  isOcr: boolean;
}

export interface StoredDocumentOcr {
  docKey: string;
  totalPages: number;
  pages: Record<number, StoredPageOcr>;
  indexedAt: number;
  isComplete: boolean;
}

function getSafeDbKey(docKey: string): string {
  return docKey.trim().replace(/^https?:\/\/[^/]+/i, '');
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openOcrDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'docKey' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

/**
 * Retrieves cached OCR text pages for a document from IndexedDB.
 */
export async function getStoredDocumentOcr(docKey: string): Promise<Record<number, StoredPageOcr> | null> {
  try {
    const db = await openOcrDb();
    const key = getSafeDbKey(docKey);

    return new Promise(resolve => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as StoredDocumentOcr | undefined;
        if (result && result.pages) {
          resolve(result.pages);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('Failed to read from IndexedDB OCR cache:', err);
    return null;
  }
}

/**
 * Saves or updates an individual page's OCR text in IndexedDB.
 */
export async function saveOcrPage(
  docKey: string,
  pageNum: number,
  pageData: { text: string; lines?: Array<{ text: string; bbox?: number[] }>; isOcr: boolean },
  totalPages: number
): Promise<void> {
  try {
    const db = await openOcrDb();
    const key = getSafeDbKey(docKey);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(key);

      getReq.onsuccess = () => {
        const existing: StoredDocumentOcr = getReq.result || {
          docKey: key,
          totalPages,
          pages: {},
          indexedAt: Date.now(),
          isComplete: false,
        };

        existing.pages[pageNum] = {
          pageNum,
          text: pageData.text,
          lines: pageData.lines,
          isOcr: pageData.isOcr,
        };

        existing.indexedAt = Date.now();
        existing.totalPages = totalPages;
        existing.isComplete = Object.keys(existing.pages).length >= totalPages;

        const putReq = store.put(existing);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('Failed to save to IndexedDB OCR cache:', err);
  }
}

/**
 * Saves a batch of pages to IndexedDB.
 */
export async function saveBatchOcrPages(
  docKey: string,
  pages: Record<number, StoredPageOcr>,
  totalPages: number
): Promise<void> {
  try {
    const db = await openOcrDb();
    const key = getSafeDbKey(docKey);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(key);

      getReq.onsuccess = () => {
        const existing: StoredDocumentOcr = getReq.result || {
          docKey: key,
          totalPages,
          pages: {},
          indexedAt: Date.now(),
          isComplete: false,
        };

        Object.assign(existing.pages, pages);
        existing.indexedAt = Date.now();
        existing.totalPages = totalPages;
        existing.isComplete = Object.keys(existing.pages).length >= totalPages;

        const putReq = store.put(existing);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('Failed to batch save to IndexedDB OCR cache:', err);
  }
}

/**
 * Retrieves full document text index from IndexedDB.
 */
export async function getStoredDocumentIndex(docKey: string): Promise<StoredDocumentOcr | null> {
  try {
    const db = await openOcrDb();
    const key = getSafeDbKey(docKey);

    return new Promise(resolve => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('Failed to read document index from IndexedDB:', err);
    return null;
  }
}

/**
 * Saves full document text index to IndexedDB.
 */
export async function saveStoredDocumentIndex(index: StoredDocumentOcr): Promise<void> {
  try {
    const db = await openOcrDb();
    const key = getSafeDbKey(index.docKey);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putReq = store.put({ ...index, docKey: key });

      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (err) {
    console.warn('Failed to save document index to IndexedDB:', err);
  }
}

