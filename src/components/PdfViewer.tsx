import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Loader2,
  AlertCircle,
  FileText,
  Search,
  X,
  ScrollText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import { getDocumentPublicUrl, getDocumentBlobUrl, normalizeStoragePath } from '../lib/supabase';
import {
  SearchMatch,
  PageTextInfo,
  searchAcrossDocument,
  extractDocumentText,
  scrollElementWithinPdfContainer,
  getCanonicalCacheKey,
  getCachedDocument,
} from '../lib/pdfSearch';
import { PdfPageItem } from './PdfPageItem';
import * as pdfWorkerModule from 'pdfjs-dist/build/pdf.worker.mjs';

// Configure PDF.js worker using same-origin local asset to guarantee mobile compatibility
let workerDisabled = false;

export function enableMainThreadPdfFallback() {
  if (workerDisabled) return;
  console.warn('Activating PDF.js main-thread rendering fallback (without Web Worker)...');
  workerDisabled = true;
  if (typeof window !== 'undefined') {
    (window as any).pdfjsWorker = pdfWorkerModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    (pdfjsLib.GlobalWorkerOptions as any).workerPort = null;
  }
}

// Register fallback module on window
if (typeof window !== 'undefined') {
  try {
    (window as any).pdfjsWorker = pdfWorkerModule;
  } catch (e) {
    console.warn('PDF.js worker fallback registration notice:', e);
  }
}

try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker initialization warning:', e);
}

// Worker health check probe for iPad Safari
let workerProbePromise: Promise<boolean> | null = null;

export async function checkWorkerHealthy(): Promise<boolean> {
  if (workerDisabled) return false;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    enableMainThreadPdfFallback();
    return false;
  }

  if (workerProbePromise) return workerProbePromise;

  workerProbePromise = new Promise<boolean>((resolve) => {
    try {
      const workerUrl = `${window.location.origin}/pdf.worker.min.mjs`;
      const probeWorker = new Worker(workerUrl, { type: 'module' });

      const timer = setTimeout(() => {
        probeWorker.terminate();
        console.warn('PDF.js worker probe timed out on iPad Safari. Enabling main-thread fallback.');
        enableMainThreadPdfFallback();
        resolve(false);
      }, 1500);

      probeWorker.onerror = (e) => {
        clearTimeout(timer);
        probeWorker.terminate();
        console.warn('PDF.js worker probe failed on iPad Safari:', e?.message || e);
        enableMainThreadPdfFallback();
        resolve(false);
      };

      // If probe stays alive without errors for 100ms, Web Worker is functioning
      setTimeout(() => {
        clearTimeout(timer);
        probeWorker.terminate();
        resolve(true);
      }, 100);
    } catch (err) {
      console.warn('Worker creation threw error on iPad Safari:', err);
      enableMainThreadPdfFallback();
      resolve(false);
    }
  });

  return workerProbePromise;
}

function getDocumentInitParams(docUrl: string) {
  return {
    url: docUrl,
    withCredentials: false,
    cMapUrl: `${window.location.origin}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${window.location.origin}/standard_fonts/`,
    isOffscreenCanvasSupported: false,
  };
}

interface PdfViewerProps {
  url?: string;
  storagePath?: string;
  fileName: string;
  title?: string;
  initialPage?: number;
  previewMode?: boolean;
  className?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  url = '',
  storagePath,
  fileName,
  title,
  initialPage = 1,
  previewMode = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Document & rendering state
  const [activeUrl, setActiveUrl] = useState<string>(url || '');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState<string>('Initializing document...');
  const [error, setError] = useState<string | null>(null);
  const [loadAttempts, setLoadAttempts] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [jumpPageInput, setJumpPageInput] = useState<string>(String(initialPage));
  const [defaultPageSize, setDefaultPageSize] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Search & Retrieval state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [pageTextMap, setPageTextMap] = useState<Map<number, PageTextInfo>>(new Map());

  // Ref to track current page without re-creating executeSearch
  const currentPageRef = useRef<number>(initialPage);
  currentPageRef.current = currentPage;

  // Ref to block intermediate scroll events while programmatically jumping to a page/match
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track the last search query that was actually executed
  const lastSearchedTermRef = useRef<string>('');

  // Stabilize defaultPageSize with ref to avoid computeFitScale recreation
  const defaultPageSizeRef = useRef(defaultPageSize);
  defaultPageSizeRef.current = defaultPageSize;

  // Auto-fit scale calculation with resilient fallbacks for tablets and phones
  const computeFitScale = useCallback((pageWidth?: number) => {
    const effectiveWidth = pageWidth || defaultPageSizeRef.current.width || 612;
    const container = scrollContainerRef.current;
    if (!container || !effectiveWidth) {
      if (typeof window !== 'undefined') {
        const available = window.innerWidth < 640
          ? window.innerWidth - 32
          : window.innerWidth < 1024
          ? window.innerWidth - 64
          : Math.min(window.innerWidth * 0.55, 800);
        return Math.max(0.35, Math.min(2.5, Math.round((available / effectiveWidth) * 100) / 100));
      }
      return 1.0;
    }
    // Account for container padding (responsive to viewport width)
    const padding = window.innerWidth < 640 ? 20 : window.innerWidth < 1024 ? 36 : 48;
    const availableWidth = container.clientWidth - padding;
    if (availableWidth <= 0) return 1.0;
    const fit = availableWidth / effectiveWidth;
    // Bound scale between 0.35 and 2.5
    return Math.max(0.35, Math.min(2.5, Math.round(fit * 100) / 100));
  }, []);

  // Track if user explicitly modified zoom level
  const userHasManuallyZoomedRef = useRef<boolean>(false);

  // Handler for explicit "Fit to Width" button
  const handleFitWidth = useCallback(() => {
    userHasManuallyZoomedRef.current = false;
    const fit = computeFitScale();
    setScale(fit);
  }, [computeFitScale]);

  // ResizeObserver and orientationchange listener to adapt scale on tablet rotation and screen resizes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let resizeTimer: NodeJS.Timeout | null = null;

    const handleAdaptScale = () => {
      // Auto-adjust scale if user hasn't manually zoomed, or on mobile/tablet viewports (< 1280px)
      if (!userHasManuallyZoomedRef.current || window.innerWidth < 1280 || previewMode) {
        setScale(computeFitScale(defaultPageSize.width));
      }
    };

    const debouncedAdaptScale = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleAdaptScale, 80);
    };

    // ResizeObserver tracks container width changes caused by tablet rotation or split view
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          debouncedAdaptScale();
        }
      }
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', debouncedAdaptScale);
    window.addEventListener('orientationchange', debouncedAdaptScale);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', debouncedAdaptScale);
      window.removeEventListener('orientationchange', debouncedAdaptScale);
    };
  }, [computeFitScale, defaultPageSize.width, previewMode]);

  // Resolve active viewing URL
  useEffect(() => {
    let isCancelled = false;

    const targetPath = storagePath || url;
    if (targetPath) {
      const publicUrl = getDocumentPublicUrl(targetPath);
      if (publicUrl && !isCancelled) {
        setActiveUrl(publicUrl);
        return;
      }
    }

    if (url && !isCancelled) {
      setActiveUrl(url);
    }

    return () => {
      isCancelled = true;
    };
  }, [url, storagePath]);

  // Canonical document key for caching across re-renders
  const canonicalDocKey = getCanonicalCacheKey(storagePath, fileName, activeUrl || url);
  const prevDocKeyRef = useRef<string>('');

  // Reset search state whenever document changes
  useEffect(() => {
    if (prevDocKeyRef.current !== canonicalDocKey) {
      prevDocKeyRef.current = canonicalDocKey;
      setSearchTerm('');
      setMatches([]);
      setCurrentMatchIndex(-1);
      setIsSearchOpen(false);
      setIsSearching(false);
      setCurrentPage(initialPage);
      setJumpPageInput(String(initialPage));
      lastSearchedTermRef.current = '';

      // Check if document text is already in memory cache
      const cached = getCachedDocument(canonicalDocKey);
      if (cached && cached.pageTextMap.size > 0) {
        setPageTextMap(new Map(cached.pageTextMap));
        setIsIndexing(false);
      } else {
        setPageTextMap(new Map());
      }
    }
  }, [canonicalDocKey, initialPage]);

  // Load PDF document with multi-stage fallback (Direct -> Blob -> Same-Origin Proxy)
  useEffect(() => {
    let isCancelled = false;
    let loadingTask: any = null;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      setLoadingStep('Accessing PDF document...');

      const targetPath = storagePath || url || activeUrl;
      const cleanPath = normalizeStoragePath(targetPath);

      // Candidate URLs to try sequentially
      const candidateUrls: string[] = [];

      if (activeUrl) candidateUrls.push(activeUrl);

      if (cleanPath) {
        // Same-origin proxy URL
        const proxyUrl = `/api/pdf-proxy?path=${encodeURIComponent(cleanPath)}`;
        if (!candidateUrls.includes(proxyUrl)) {
          candidateUrls.push(proxyUrl);
        }
      }

      let loadedDoc: any = null;
      let lastError: any = null;

      // Verify worker health before starting; if worker is restricted (e.g. iPad Safari), activate fallback
      await checkWorkerHealthy();

      for (let i = 0; i < candidateUrls.length; i++) {
        if (isCancelled) return;
        const currentCandidate = candidateUrls[i];
        try {
          setLoadingStep(`Loading PDF (attempt ${i + 1}/${candidateUrls.length})...`);
          
          loadingTask = pdfjsLib.getDocument(getDocumentInitParams(currentCandidate));
          loadedDoc = await loadingTask.promise;
          if (loadedDoc) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`PDF candidate ${currentCandidate} failed:`, err?.message || err);

          // If worker initialization or execution failed, activate main-thread fallback and retry immediately
          const isWorkerIssue =
            err?.message?.includes('worker') ||
            err?.message?.includes('Worker') ||
            err?.name === 'WorkerError' ||
            err?.message?.includes('Setting up fake worker failed');

          if (isWorkerIssue && !workerDisabled) {
            console.warn('Worker failure detected on iPad Safari. Switching to main-thread fallback...');
            enableMainThreadPdfFallback();
            try {
              loadingTask = pdfjsLib.getDocument(getDocumentInitParams(currentCandidate));
              loadedDoc = await loadingTask.promise;
              if (loadedDoc) break;
            } catch (fallbackErr: any) {
              lastError = fallbackErr;
              console.error('Fallback attempt failed:', fallbackErr);
            }
          }
        }
      }

      // If candidates failed, try blob download directly
      if (!loadedDoc && cleanPath && !isCancelled) {
        try {
          setLoadingStep('Fetching document blob fallback...');
          const blobUrl = await getDocumentBlobUrl(cleanPath);
          if (blobUrl && !isCancelled) {
            loadingTask = pdfjsLib.getDocument(getDocumentInitParams(blobUrl));
            loadedDoc = await loadingTask.promise;
          }
        } catch (blobErr: any) {
          lastError = blobErr;
          console.warn('Blob fallback error:', blobErr);

          if (!workerDisabled) {
            enableMainThreadPdfFallback();
            try {
              const blobUrl = await getDocumentBlobUrl(cleanPath);
              if (blobUrl && !isCancelled) {
                loadingTask = pdfjsLib.getDocument(getDocumentInitParams(blobUrl));
                loadedDoc = await loadingTask.promise;
              }
            } catch (fallbackBlobErr) {
              lastError = fallbackBlobErr;
            }
          }
        }
      }

      if (isCancelled) return;

      if (loadedDoc) {
        setPdfDoc(loadedDoc);
        setTotalPages(loadedDoc.numPages);
        setCurrentPage(initialPage);
        setJumpPageInput(String(initialPage));

        // Get initial page dimensions to size placeholders and auto-fit
        try {
          const firstPage = await loadedDoc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1.0 });
          const baseSize = { width: Math.floor(vp.width), height: Math.floor(vp.height) };
          setDefaultPageSize(prev => (prev.width === baseSize.width && prev.height === baseSize.height ? prev : baseSize));

          // Auto-fit scale on mobile / tablet / preview mode
          const fit = computeFitScale(baseSize.width);
          setScale(fit);
          // Refined adjustment once layout finishes settling in DOM
          setTimeout(() => {
            if (!userHasManuallyZoomedRef.current) {
              setScale(computeFitScale(baseSize.width));
            }
          }, 120);
        } catch {
          // Responsive fallback scale
          if (window.innerWidth < 640) {
            setScale(0.65);
          } else if (window.innerWidth < 1024) {
            setScale(0.9);
          } else {
            setScale(1.1);
          }
        }

        setLoading(false);
      } else {
        const errorMsg =
          lastError?.message ||
          'Unable to load the PDF. Please ensure the file is accessible and try again.';
        setError(errorMsg);
        setLoading(false);
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {}
      }
    };
  }, [activeUrl, initialPage, storagePath, url, loadAttempts, computeFitScale]);

  // Keep scale ref updated for touch gestures without tearing down event listeners
  const scaleRef = useRef<number>(scale);
  scaleRef.current = scale;

  // Touch gesture handler for tablet & phone pinch-to-zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let initialTouchDistance = 0;
    let initialScale = 1.0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialTouchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialScale = scaleRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialTouchDistance > 0) {
        if (e.cancelable) e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const factor = currentDistance / initialTouchDistance;
        const newScale = Math.max(0.35, Math.min(2.5, Math.round(initialScale * factor * 100) / 100));
        userHasManuallyZoomedRef.current = true;
        setScale(newScale);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialTouchDistance = 0;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  // Extract full-document text in background so search is immediately available across all pages
  useEffect(() => {
    if (!pdfDoc || totalPages <= 0) return;
    const cacheKey = getCanonicalCacheKey(storagePath, fileName, activeUrl || url);

    // If memory cache already has complete text, hydrate state and skip indexing
    const memoryCached = getCachedDocument(cacheKey);
    if (memoryCached && memoryCached.pageTextMap.size >= totalPages) {
      setPageTextMap(new Map(memoryCached.pageTextMap));
      setIsIndexing(false);
      return;
    }

    let isCancelled = false;
    setIsIndexing(true);

    extractDocumentText(pdfDoc, cacheKey, info => {
      if (isCancelled) return;
      if (info.pageInfo) {
        setPageTextMap(prev => {
          const next = new Map(prev);
          next.set(info.pageInfo!.pageNum, info.pageInfo!);
          return next;
        });
      }
      if (info.isDone) {
        setIsIndexing(false);
      }
    })
      .then(data => {
        if (isCancelled) return;
        setPageTextMap(data.pageTextMap);
        setIsIndexing(false);
      })
      .catch(err => {
        console.warn('Document text indexing notice:', err);
        if (!isCancelled) {
          setIsIndexing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, storagePath, url, activeUrl, fileName, totalPages]);

  // Scroll internal PDF container to specific page WITHOUT scrolling the main website
  const scrollToPageInternal = (pageNum: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (!pageEl) return;

    const containerRect = container.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    const relativeTop = pageRect.top - containerRect.top + container.scrollTop;

    container.scrollTo({
      top: Math.max(0, relativeTop - 16),
      behavior: 'smooth',
    });
  };

  // Jump smoothly to a specific search match in either Continuous or Single Page mode
  const jumpToMatch = useCallback((match: SearchMatch) => {
    if (!match) return;
    setCurrentPage(match.pageNum);
    setJumpPageInput(String(match.pageNum));

    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 1000);

    if (viewMode === 'continuous') {
      const matchEl = document.querySelector(`[data-match-id="${match.id}"]`) as HTMLElement | null;
      if (matchEl) {
        scrollElementWithinPdfContainer(matchEl, { align: 'center' });
      } else {
        scrollToPageInternal(match.pageNum);
        // Retry centering on the match once the page completes rendering
        [120, 250, 450, 750].forEach(delay => {
          setTimeout(() => {
            const el = document.querySelector(`[data-match-id="${match.id}"]`) as HTMLElement | null;
            if (el) {
              scrollElementWithinPdfContainer(el, { align: 'center' });
            }
          }, delay);
        });
      }
    } else {
      // Single page mode: retry centering on the match once the page completes rendering
      [80, 220, 500].forEach(delay => {
        setTimeout(() => {
          const el = document.querySelector(`[data-match-id="${match.id}"]`) as HTMLElement | null;
          if (el) {
            scrollElementWithinPdfContainer(el, { align: 'center' });
          }
        }, delay);
      });
    }
  }, [viewMode]);

  // Keep search refs updated so executeSearch has stable dependencies without re-creating
  const matchesRef = useRef<SearchMatch[]>([]);
  matchesRef.current = matches;

  const currentMatchIndexRef = useRef<number>(-1);
  currentMatchIndexRef.current = currentMatchIndex;

  const pageTextMapRef = useRef<Map<number, PageTextInfo>>(pageTextMap);
  pageTextMapRef.current = pageTextMap;

  const jumpToMatchRef = useRef<(match: SearchMatch) => void>(() => {});
  jumpToMatchRef.current = jumpToMatch;

  // Execute search across entire document (case-insensitive, exact literal text)
  const executeSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      lastSearchedTermRef.current = trimmed;

      if (!trimmed) {
        setMatches([]);
        setCurrentMatchIndex(-1);
        matchesRef.current = [];
        currentMatchIndexRef.current = -1;
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      const results = searchAcrossDocument(trimmed, pageTextMapRef.current, totalPages);
      setMatches(results);
      matchesRef.current = results;

      // If document is still indexing in the background and no matches have appeared yet,
      // preserve the brief "Searching..." state until matches appear or indexing finishes
      if (isIndexing && results.length === 0) {
        setIsSearching(true);
      } else {
        setIsSearching(false);
      }

      if (results.length > 0) {
        const curr = currentPageRef.current;
        let targetIdx = 0;
        const prevIdx = currentMatchIndexRef.current;

        // If we had a previously selected match that still exists in results, preserve selection
        if (prevIdx >= 0 && prevIdx < matchesRef.current.length) {
          const currentSelectedId = matchesRef.current[prevIdx]?.id;
          if (currentSelectedId) {
            const newIdx = results.findIndex(m => m.id === currentSelectedId);
            if (newIdx !== -1) {
              targetIdx = newIdx;
            } else {
              const next = results.findIndex(m => m.pageNum >= curr);
              targetIdx = next !== -1 ? next : 0;
            }
          }
        } else {
          // Otherwise pick the match on or closest after the current visible page
          const next = results.findIndex(m => m.pageNum >= curr);
          targetIdx = next !== -1 ? next : 0;
        }

        setCurrentMatchIndex(targetIdx);
        currentMatchIndexRef.current = targetIdx;
        jumpToMatchRef.current(results[targetIdx]);
      } else {
        setCurrentMatchIndex(-1);
        currentMatchIndexRef.current = -1;
      }
    },
    [totalPages, isIndexing]
  );

  // Search execution with instant response when text index is ready
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setIsSearching(false);
      setMatches([]);
      setCurrentMatchIndex(-1);
      matchesRef.current = [];
      currentMatchIndexRef.current = -1;
      lastSearchedTermRef.current = '';
      return;
    }

    // If index is already loaded, execute search instantly without waiting
    const isIndexReady = !isIndexing && pageTextMap.size > 0;
    if (isIndexReady) {
      executeSearch(trimmed);
      return;
    }

    // If still indexing in the background, set searching indicator and run
    setIsSearching(true);
    const timer = setTimeout(() => {
      executeSearch(trimmed);
    }, 120);

    return () => clearTimeout(timer);
  }, [searchTerm, isIndexing, pageTextMap.size, executeSearch]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
  };

  const goToNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    jumpToMatch(matches[nextIdx]);
  };

  const goToPrevMatch = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    jumpToMatch(matches[prevIdx]);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchTerm('');
    setMatches([]);
    setCurrentMatchIndex(-1);
    lastSearchedTermRef.current = '';
  };

  // Keyboard shortcut handler: Ctrl+F / Cmd+F, Enter, Shift+Enter, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const isFindKey = (isMac ? e.metaKey : e.ctrlKey) && (e.key === 'f' || e.key === 'F');

      if (isFindKey) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      } else if (e.key === 'Escape' && isSearchOpen) {
        e.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isSearchOpen]);

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchTerm.trim() !== lastSearchedTermRef.current) {
        executeSearch(searchTerm);
      } else {
        if (e.shiftKey) {
          goToPrevMatch();
        } else {
          goToNextMatch();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  };

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn('Could not enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleZoomIn = () => {
    userHasManuallyZoomedRef.current = true;
    setScale(prev => Math.min(prev + 0.15, 2.5));
  };

  const handleZoomOut = () => {
    userHasManuallyZoomedRef.current = true;
    setScale(prev => Math.max(prev - 0.15, 0.4));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const p = currentPage - 1;
      setCurrentPage(p);
      setJumpPageInput(String(p));
      if (viewMode === 'continuous') {
        isProgrammaticScrollRef.current = true;
        if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 700);
        scrollToPageInternal(p);
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const p = currentPage + 1;
      setCurrentPage(p);
      setJumpPageInput(String(p));
      if (viewMode === 'continuous') {
        isProgrammaticScrollRef.current = true;
        if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 700);
        scrollToPageInternal(p);
      }
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(jumpPageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
      if (viewMode === 'continuous') {
        isProgrammaticScrollRef.current = true;
        if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 700);
        scrollToPageInternal(val);
      }
    } else {
      setJumpPageInput(String(currentPage));
    }
  };

  const currentMatch = matches[currentMatchIndex] || null;

  // Responsive height handling: works seamlessly on mobile (using dvh / vh) and desktop
  const defaultHeightClasses = previewMode
    ? 'h-full min-h-0 max-h-full'
    : 'h-[78vh] sm:h-[82vh] lg:h-[calc(100vh-7rem)] min-h-[460px] sm:min-h-[520px] max-h-[calc(100vh-6rem)]';

  const containerLayoutClass = isFullscreen
    ? 'fixed inset-0 z-50 rounded-none h-screen w-screen max-h-screen'
    : `${defaultHeightClasses} ${className || ''}`;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all w-full ${containerLayoutClass}`}
    >
      {/* Viewer Toolbar - Responsive & Touch-friendly */}
      <div className="flex-none sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border-b border-white/10 text-slate-200 select-none">
        {/* Left Section: Document Format Badge & Page Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          <div className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-950/80 border border-white/10 text-xs font-medium text-amber-300 shadow-inner">
            <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-[11px] sm:text-xs">Original PDF</span>
          </div>

          {!previewMode && (
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-white/5">
              <button
                id="btn-pdf-prev"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1.5 sm:p-2 rounded hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-slate-300 hover:text-white touch-manipulation"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <form onSubmit={handleJumpSubmit} className="flex items-center gap-1 px-1 text-xs">
                <input
                  id="input-pdf-jump-page"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={jumpPageInput}
                  onChange={e => setJumpPageInput(e.target.value)}
                  onBlur={handleJumpSubmit}
                  className="w-8 sm:w-10 py-0.5 text-center bg-slate-950 border border-white/10 rounded text-slate-200 focus:outline-none focus:border-amber-400 font-mono text-xs"
                  title="Type page number and press Enter"
                />
                <span className="text-slate-500">/</span>
                <span className="text-slate-300 font-mono text-xs">{totalPages}</span>
              </form>

              <button
                id="btn-pdf-next"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1.5 sm:p-2 rounded hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-slate-300 hover:text-white touch-manipulation"
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Mode Toggle: Continuous Scroll vs Single Page */}
          {!previewMode && pdfDoc && (
            <button
              id="btn-pdf-view-mode"
              onClick={() => {
                const nextMode = viewMode === 'continuous' ? 'single' : 'continuous';
                setViewMode(nextMode);
                if (nextMode === 'continuous') {
                  setTimeout(() => {
                    scrollToPageInternal(currentPage);
                  }, 50);
                }
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 border border-white/10 text-xs text-slate-300 hover:text-white transition-all touch-manipulation"
              title={`Switch to ${viewMode === 'continuous' ? 'Single Page' : 'Continuous Scroll'} Mode`}
            >
              <ScrollText className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">{viewMode === 'continuous' ? 'Continuous' : 'Single Page'}</span>
            </button>
          )}
        </div>

        {/* Right Section: Search Toggle, Zoom Controls, Rotate, and Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {pdfDoc && (
            <button
              id="btn-pdf-search-toggle"
              onClick={() => {
                setIsSearchOpen(prev => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => searchInputRef.current?.focus(), 80);
                  }
                  return next;
                });
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold transition-all active:scale-95 touch-manipulation cursor-pointer border ${
                isSearchOpen
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-700/80 border-amber-500/30 text-amber-200 hover:text-white'
              }`}
              title="Search in document (Ctrl+F / Cmd+F)"
              aria-label="Search In Document"
            >
              <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-xs tracking-tight">Search</span>
            </button>
          )}

          {/* Zoom Controls & Fit Width */}
          {pdfDoc && (
            <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-0.5 border border-white/5">
              <button
                id="btn-pdf-zoom-out"
                onClick={handleZoomOut}
                disabled={scale <= 0.4}
                className="p-1.5 sm:p-2 rounded hover:bg-white/10 active:scale-95 disabled:opacity-30 transition-all text-slate-300 hover:text-white touch-manipulation"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <span className="px-1 text-[11px] sm:text-xs font-mono text-slate-300 min-w-[40px] sm:min-w-[44px] text-center">
                {Math.round(scale * 100)}%
              </span>

              <button
                id="btn-pdf-zoom-in"
                onClick={handleZoomIn}
                disabled={scale >= 2.5}
                className="p-1.5 sm:p-2 rounded hover:bg-white/10 active:scale-95 disabled:opacity-30 transition-all text-slate-300 hover:text-white touch-manipulation"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Fit Width Button */}
              <button
                id="btn-pdf-fit-width"
                onClick={handleFitWidth}
                className="px-2 py-1 rounded hover:bg-white/10 active:scale-95 text-[11px] font-medium text-amber-300/90 hover:text-amber-300 transition-all border-l border-white/10 touch-manipulation"
                title="Fit to screen width"
                aria-label="Fit to Width"
              >
                Fit
              </button>
            </div>
          )}

          {!previewMode && pdfDoc && (
            <button
              id="btn-pdf-rotate"
              onClick={handleRotate}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/60 hover:bg-white/10 active:scale-95 border border-white/5 text-slate-300 hover:text-white transition-all touch-manipulation"
              title="Rotate 90° clockwise"
              aria-label="Rotate Page"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          {!previewMode && (
            <button
              id="btn-pdf-fullscreen"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/60 hover:bg-white/10 active:scale-95 border border-white/5 text-slate-300 hover:text-white transition-all touch-manipulation"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Dedicated In-Document Search Panel for Mobile, iPad, and Desktop */}
      {isSearchOpen && (
        <div
          id="pdf-search-panel"
          className="flex-none sticky top-0 z-30 w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900/98 backdrop-blur-md border-b border-amber-500/30 shadow-xl text-slate-100 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input Field */}
            <div className="flex-1 relative flex items-center min-w-[200px]">
              <Search className="absolute left-3 w-4 h-4 text-amber-400 pointer-events-none shrink-0" />
              <input
                ref={searchInputRef}
                id="input-pdf-search"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchInputKeyDown}
                placeholder="Search in document..."
                className="w-full bg-slate-950 border border-white/20 rounded-xl pl-9 pr-9 py-2 text-base sm:text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 touch-manipulation"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {searchTerm && (
                <button
                  type="button"
                  id="btn-pdf-search-clear"
                  onClick={() => {
                    setSearchTerm('');
                    executeSearch('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-200 active:scale-90 touch-manipulation cursor-pointer"
                  title="Clear search"
                  aria-label="Clear Search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Match Results & Navigation Controls */}
            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap sm:flex-nowrap">
              {/* Results Counter / Status */}
              {isSearching ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300">
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  <span className="text-[11px] whitespace-nowrap font-medium">Searching...</span>
                </div>
              ) : searchTerm.trim() ? (
                matches.length > 0 ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold whitespace-nowrap">
                    <span>
                      {matches.length} {matches.length === 1 ? 'match' : 'matches'}
                    </span>
                    {currentMatch && (
                      <span className="text-[11px] font-normal text-amber-300/80 ml-1">
                        (Page {currentMatch.pageNum})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium whitespace-nowrap">
                    No results found
                  </span>
                )
              ) : null}

              {/* Previous & Next Navigation Controls */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-white/10">
                <button
                  id="btn-pdf-search-prev"
                  onClick={goToPrevMatch}
                  disabled={matches.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-xs text-slate-200 font-medium transition-all touch-manipulation cursor-pointer min-h-[36px]"
                  title="Previous match (Shift+Enter)"
                  aria-label="Previous Match"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="text-xs">Previous</span>
                </button>

                <span className="px-2 font-mono text-xs text-slate-300 min-w-[48px] text-center whitespace-nowrap">
                  {matches.length > 0 ? `${currentMatchIndex + 1} / ${matches.length}` : '0 / 0'}
                </span>

                <button
                  id="btn-pdf-search-next"
                  onClick={goToNextMatch}
                  disabled={matches.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-xs text-slate-200 font-medium transition-all touch-manipulation cursor-pointer min-h-[36px]"
                  title="Next match (Enter)"
                  aria-label="Next Match"
                >
                  <span className="text-xs">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Close Button */}
              <button
                id="btn-pdf-search-close"
                onClick={closeSearch}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-slate-100 transition-all touch-manipulation cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center border border-white/5"
                title="Close search (Escape)"
                aria-label="Close Search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewer Body: 100% Browser-Based Canvas & Selectable Text Rendering */}
      <div
        ref={scrollContainerRef}
        className="pdf-scroll-container relative flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto overscroll-contain bg-slate-950/90 flex flex-col items-center p-2 sm:p-4 md:p-6"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20 p-6 text-center">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-200">{loadingStep}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Rendering original academic PDF with responsive layout, vector typography, tables, and figures
            </p>
          </div>
        )}

        {error && !pdfDoc ? (
          <div className="flex flex-col items-center justify-center max-w-md p-6 sm:p-8 my-auto text-center bg-slate-900/80 border border-red-500/30 rounded-2xl shadow-xl">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <h4 className="text-base font-semibold text-slate-100 mb-1">Document Load Notice</h4>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">{error}</p>
            <button
              onClick={() => setLoadAttempts(prev => prev + 1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-600/30 touch-manipulation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Loading PDF</span>
            </button>
          </div>
        ) : pdfDoc ? (
          viewMode === 'continuous' ? (
            /* Continuous Multi-Page Scrolling Stack */
            <div className="flex flex-col items-center w-full py-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <PdfPageItem
                  key={`page-${p}`}
                  pageNum={p}
                  pdfDoc={pdfDoc}
                  scale={scale}
                  rotation={rotation}
                  defaultSize={defaultPageSize}
                  pageInfo={pageTextMap.get(p)}
                  matches={matches.filter(m => m.pageNum === p)}
                  selectedMatchId={currentMatch?.pageNum === p ? currentMatch.id : null}
                  searchTerm={searchTerm}
                  isSinglePageMode={false}
                  onPageVisible={activePage => {
                    if (!isProgrammaticScrollRef.current) {
                      setCurrentPage(activePage);
                      setJumpPageInput(String(activePage));
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            /* Single Page View */
            <div className="flex justify-center items-center my-auto w-full py-2">
              <PdfPageItem
                key={`single-page-${currentPage}`}
                pageNum={currentPage}
                pdfDoc={pdfDoc}
                scale={scale}
                rotation={rotation}
                defaultSize={defaultPageSize}
                pageInfo={pageTextMap.get(currentPage)}
                matches={matches.filter(m => m.pageNum === currentPage)}
                selectedMatchId={currentMatch?.pageNum === currentPage ? currentMatch.id : null}
                searchTerm={searchTerm}
                isSinglePageMode={true}
              />
            </div>
          )
        ) : null}
      </div>

      {/* Page indicator & Document footer */}
      <div className="flex-none px-3 sm:px-4 py-2 bg-slate-900/90 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 select-none z-10">
        <span className="truncate max-w-[180px] sm:max-w-md font-mono text-[11px] text-slate-400">
          {fileName}
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          {matches.length > 0 && (
            <span className="text-amber-400 font-mono text-[11px]">
              Match {currentMatchIndex + 1} of {matches.length}
            </span>
          )}
          <span className="text-[11px] text-slate-400 font-mono">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
};
