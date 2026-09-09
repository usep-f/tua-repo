import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  SearchMatch,
  PageTextInfo,
  HighlightRect,
  computePageHighlightBoxes,
  computeMobileSingleMatchHighlight,
  isMobileOrTabletDevice,
  injectOcrSpansIntoTextLayer,
  scrollElementWithinPdfContainer,
} from '../lib/pdfSearch';

interface PdfPageItemProps {
  pageNum: number;
  pdfDoc: any;
  scale: number;
  rotation: number;
  pageInfo?: PageTextInfo;
  matches: SearchMatch[];
  selectedMatchId: string | null;
  searchTerm?: string;
  onPageVisible?: (pageNum: number) => void;
  isSinglePageMode?: boolean;
  defaultSize?: { width: number; height: number };
}

export const PdfPageItem: React.FC<PdfPageItemProps> = memo(({
  pageNum,
  pdfDoc,
  scale,
  rotation,
  pageInfo,
  matches,
  selectedMatchId,
  searchTerm = '',
  onPageVisible,
  isSinglePageMode = false,
  defaultSize = { width: 612, height: 792 },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [shouldRender, setShouldRender] = useState<boolean>(isSinglePageMode);
  const [rendered, setRendered] = useState<boolean>(false);
  const [highlights, setHighlights] = useState<HighlightRect[]>([]);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: Math.floor(defaultSize.width * scale),
    height: Math.floor(defaultSize.height * scale),
  });

  // Device detection: Mobile/tablet uses lightweight on-demand single-match highlighting
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(() => isMobileOrTabletDevice());

  useEffect(() => {
    const handleDeviceCheck = () => {
      setIsMobileOrTablet(isMobileOrTabletDevice());
    };
    window.addEventListener('resize', handleDeviceCheck, { passive: true });
    window.addEventListener('orientationchange', handleDeviceCheck, { passive: true });
    return () => {
      window.removeEventListener('resize', handleDeviceCheck);
      window.removeEventListener('orientationchange', handleDeviceCheck);
    };
  }, []);

  // Mobile / Tablet: Identify if the currently selected match belongs to this page
  const selectedMatchOnThisPage = useMemo(() => {
    if (!isMobileOrTablet || !selectedMatchId || matches.length === 0) return null;
    return matches.find(m => m.id === selectedMatchId) || null;
  }, [isMobileOrTablet, selectedMatchId, matches]);

  // Mobile / Tablet: Force render this page immediately when it has the selected match
  useEffect(() => {
    if (isMobileOrTablet && selectedMatchOnThisPage) {
      setShouldRender(true);
    }
  }, [isMobileOrTablet, selectedMatchOnThisPage]);

  // Mobile / Tablet: Dedicated lightweight single-match highlighting
  const computeAndApplyHighlightMobile = useCallback(
    (targetDiv: HTMLElement | null) => {
      if (!targetDiv) return;

      const trimmed = searchTerm.trim();
      if (!trimmed || !selectedMatchOnThisPage) {
        setHighlights([]);
        return;
      }

      // Compute bounding box ONLY for the single selected match on this page
      const boxes = computeMobileSingleMatchHighlight(
        targetDiv,
        pageNum,
        matches,
        selectedMatchOnThisPage,
        trimmed,
        pageSize
      );
      setHighlights(boxes);
    },
    [searchTerm, selectedMatchOnThisPage, pageNum, matches, pageSize]
  );

  // Mobile / Tablet: Dedicated on-demand single-match highlighting
  // - Only executes when this page contains the active match AND has rendered
  // - Generates highlight ONLY for that single matching word
  // - Stops all calculations once generated
  // - Does NOT recalculate on scroll
  // - Automatically removes highlight when user selects a different match
  useEffect(() => {
    if (!isMobileOrTablet) return;

    // If no match is selected or selected match is on another page, immediately release highlights
    if (!selectedMatchOnThisPage || !rendered || !textLayerRef.current) {
      if (highlights.length > 0) {
        setHighlights([]);
      }
      return;
    }

    const term = searchTerm.trim();
    if (!term) {
      setHighlights([]);
      return;
    }

    // If OCR text arrived after initial canvas render, inject spans into textLayer now
    if (pageInfo?.isOcr && pageInfo.text && textLayerRef.current.children.length === 0) {
      injectOcrSpansIntoTextLayer(textLayerRef.current, pageInfo.text, {
        width: pageSize.width,
        height: pageSize.height,
      });
    }

    // Page is already rendered; compute the single selected match highlight once
    computeAndApplyHighlightMobile(textLayerRef.current);

    const frameId = requestAnimationFrame(() => {
      if (textLayerRef.current) {
        computeAndApplyHighlightMobile(textLayerRef.current);
      }
    });

    // Secondary pass to ensure position stability after layout settle during navigation
    const timer = setTimeout(() => {
      if (textLayerRef.current) {
        computeAndApplyHighlightMobile(textLayerRef.current);
      }
    }, 120);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
    };
  }, [
    isMobileOrTablet,
    selectedMatchOnThisPage,
    rendered,
    searchTerm,
    pageInfo,
    pageSize,
    scale,
    computeAndApplyHighlightMobile,
  ]);

  // Desktop / Laptop: Full search highlighting across all matches on this page (LOCKED)
  const computeAndApplyHighlightsDesktop = useCallback(
    (targetDiv: HTMLElement | null) => {
      if (!targetDiv) return;

      const trimmed = searchTerm.trim();
      if (!trimmed || matches.length === 0) {
        setHighlights([]);
        return;
      }

      const boxes = computePageHighlightBoxes(
        targetDiv,
        pageNum,
        matches,
        trimmed,
        pageSize,
        null
      );
      setHighlights(boxes);
    },
    [searchTerm, matches, pageNum, pageSize]
  );

  // IntersectionObserver to render pages ahead of viewport in continuous mode
  // and scroll listener fallback for iOS WebKit touch inertia
  useEffect(() => {
    // Pages 1-3 or single-page mode always render immediately
    if (isSinglePageMode || pageNum <= 3) {
      setShouldRender(true);
    }

    const container = containerRef.current;
    if (!container) return;

    // Load Observer: Mounts canvas when within 1200px of viewport using native viewport root
    const loadObserver = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setShouldRender(true);
        }
      },
      { root: null, rootMargin: '1200px 0px' }
    );

    // Active page indicator observer (threshold: 0.3 relative to viewport)
    const activeObserver = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && onPageVisible) {
          onPageVisible(pageNum);
        }
      },
      { root: null, threshold: 0.3 }
    );

    loadObserver.observe(container);
    activeObserver.observe(container);

    // Fallback scroll listener for iOS/iPadOS Safari touch momentum
    const scrollParent = container.closest('.pdf-scroll-container') as HTMLElement | null;
    let scrollTimer: NodeJS.Timeout | null = null;
    const handleScrollCheck = () => {
      if (!scrollParent || shouldRender) return;
      const rect = container.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect();
      // If within 1000px of visible scroll area, render
      if (rect.bottom >= parentRect.top - 1000 && rect.top <= parentRect.bottom + 1000) {
        setShouldRender(true);
      }
    };

    if (scrollParent) {
      scrollParent.addEventListener('scroll', handleScrollCheck, { passive: true });
    }

    return () => {
      loadObserver.disconnect();
      activeObserver.disconnect();
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', handleScrollCheck);
      }
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [pageNum, onPageVisible, isSinglePageMode, shouldRender]);

  // If a match is selected on this page, force render immediately
  useEffect(() => {
    if (selectedMatchId && matches.some(m => m.id === selectedMatchId)) {
      setShouldRender(true);
    }
  }, [selectedMatchId, matches]);

  // Render canvas & text layer when shouldRender is true
  useEffect(() => {
    if (!shouldRender || !pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;
    let textLayerTask: any = null;
    let cancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale, rotation });
        const pixelWidth = Math.floor(viewport.width);
        const pixelHeight = Math.floor(viewport.height);

        setPageSize({ width: pixelWidth, height: pixelHeight });

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Mobile optimization: Clamp devicePixelRatio to max 2.0 to prevent iOS Safari 224MB canvas memory crashes
        const rawDpr = window.devicePixelRatio || 1;
        const outputScale = Math.min(rawDpr, 2.0);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${pixelWidth}px`;
        canvas.style.height = `${pixelHeight}px`;

        // Clear canvas with default transform
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform,
        });

        await renderTask.promise;
        if (cancelled) return;

        // Render PDF.js selectable text layer
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${pixelWidth}px`;
          textLayerDiv.style.height = `${pixelHeight}px`;
          textLayerDiv.style.setProperty('--total-scale-factor', String(scale));
          textLayerDiv.style.setProperty('--scale-factor', String(scale));

          try {
            const textContentSource = await page.getTextContent();
            if (cancelled) return;

            const hasNativeText = textContentSource.items && textContentSource.items.length > 0;

            if (hasNativeText) {
              const textLayer = new (pdfjsLib as any).TextLayer({
                textContentSource,
                container: textLayerDiv,
                viewport,
              });
              textLayerTask = textLayer;
              await textLayer.render();
              if (cancelled) return;
            } else if (pageInfo?.text) {
              // Scanned PDF page: Inject OCR text spans for selectable text and search highlights
              injectOcrSpansIntoTextLayer(textLayerDiv, pageInfo.text, viewport);
            }

            // Compute visual search highlights
            if (!isMobileOrTablet) {
              // Desktop / Laptop: Full search highlighting across all matches on this page (LOCKED)
              if (matches.length > 0 && searchTerm.trim()) {
                computeAndApplyHighlightsDesktop(textLayerDiv);
                requestAnimationFrame(() => {
                  if (textLayerRef.current && !cancelled) {
                    computeAndApplyHighlightsDesktop(textLayerRef.current);
                  }
                });
              } else {
                setHighlights([]);
              }
            } else {
              // Mobile / Tablet: Lightweight single-match highlight for the active matching page
              if (selectedMatchOnThisPage && searchTerm.trim()) {
                computeAndApplyHighlightMobile(textLayerDiv);
                requestAnimationFrame(() => {
                  if (textLayerRef.current && !cancelled) {
                    computeAndApplyHighlightMobile(textLayerRef.current);
                  }
                });
              } else {
                setHighlights([]);
              }
            }
          } catch (textErr) {
            console.warn(`TextLayer notice on page ${pageNum}:`, textErr);
          }
        }

        setRendered(true);
      } catch (err: any) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
      if (textLayerTask) {
        try {
          textLayerTask.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNum, scale, rotation, shouldRender]);

  // Desktop: Update highlights if matches, selected match, searchTerm, zoom scale, or OCR pageInfo change
  const prevMatchesRef = useRef<SearchMatch[]>(matches);
  const prevSearchTermRef = useRef<string>(searchTerm);
  const prevSelectedMatchIdRef = useRef<string | null>(selectedMatchId);
  const prevScaleRef = useRef<number>(scale);

  useEffect(() => {
    if (isMobileOrTablet) return;
    if (!rendered || !textLayerRef.current) return;

    // If OCR text arrived after initial canvas render, inject spans now
    if (pageInfo?.isOcr && pageInfo.text && textLayerRef.current.children.length === 0) {
      injectOcrSpansIntoTextLayer(textLayerRef.current, pageInfo.text, {
        width: pageSize.width,
        height: pageSize.height,
      });
    }

    if (matches.length === 0 || !searchTerm.trim()) {
      setHighlights([]);
      prevMatchesRef.current = matches;
      prevSearchTermRef.current = searchTerm;
      prevSelectedMatchIdRef.current = selectedMatchId;
      prevScaleRef.current = scale;
      return;
    }

    prevMatchesRef.current = matches;
    prevSearchTermRef.current = searchTerm;
    prevSelectedMatchIdRef.current = selectedMatchId;
    prevScaleRef.current = scale;

    computeAndApplyHighlightsDesktop(textLayerRef.current);

    const frameId = requestAnimationFrame(() => {
      if (textLayerRef.current) {
        computeAndApplyHighlightsDesktop(textLayerRef.current);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [
    matches,
    selectedMatchId,
    searchTerm,
    rendered,
    pageInfo,
    pageSize,
    scale,
    isMobileOrTablet,
    computeAndApplyHighlightsDesktop,
  ]);

  // Smoothly center on the selected match when active on this page
  useEffect(() => {
    if (!selectedMatchId) return;
    const isMatchOnThisPage = matches.some(m => m.id === selectedMatchId);
    if (!isMatchOnThisPage) return;

    const timer = setTimeout(() => {
      const activeEl = containerRef.current?.querySelector(`[data-match-id="${selectedMatchId}"]`) as HTMLElement | null;
      if (activeEl) {
        scrollElementWithinPdfContainer(activeEl, { align: 'center' });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [selectedMatchId, matches]);

  return (
    <div
      id={`pdf-page-${pageNum}`}
      ref={containerRef}
      className="relative mb-5 last:mb-2 shadow-xl rounded-lg overflow-hidden border border-white/10 bg-white select-text cursor-text transition-all max-w-full touch-pan-y"
      style={{
        width: `${pageSize.width}px`,
        minHeight: `${pageSize.height}px`,
        touchAction: 'pan-y',
      }}
    >
      {shouldRender ? (
        <>
          <canvas
            ref={canvasRef}
            className="block select-none pointer-events-none max-w-full"
            style={{
              touchAction: 'pan-y',
              width: `${pageSize.width}px`,
              height: `${pageSize.height}px`,
            }}
          />

          {/* Selectable text layer overlay with touch-pan-y to preserve native touch scrolling on tablets */}
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 select-text pointer-events-auto touch-pan-y"
            style={{
              width: `${pageSize.width}px`,
              height: `${pageSize.height}px`,
              zIndex: 2,
              touchAction: 'pan-y',
              ['--total-scale-factor' as any]: scale,
              ['--scale-factor' as any]: scale,
            }}
          />

          {/* Search Highlights Visual Overlay Layer */}
          {highlights.length > 0 && (
            <div
              className="pdf-highlights-overlay absolute inset-0 pointer-events-none"
              style={{
                width: `${pageSize.width}px`,
                height: `${pageSize.height}px`,
                zIndex: 3,
              }}
            >
              {highlights.map(h => {
                const isSelected = isMobileOrTablet || h.matchId === selectedMatchId;
                return (
                  <div
                    key={h.id}
                    data-match-id={h.matchId}
                    className={`pdf-search-match ${isSelected ? 'pdf-search-match-selected' : ''}`}
                    style={{
                      left: `${h.left}px`,
                      top: `${h.top}px`,
                      width: `${h.width}px`,
                      height: `${h.height}px`,
                      ...(isMobileOrTablet
                        ? {
                            backgroundColor: 'rgba(245, 158, 11, 0.85)',
                            boxShadow: '0 0 0 2px rgb(245, 158, 11), 0 0 14px rgba(245, 158, 11, 0.85)',
                            zIndex: 10,
                          }
                        : {}),
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Lightweight memory-saving placeholder while scrolled far outside viewport */
        <div
          className="flex flex-col items-center justify-center bg-slate-900/30 text-slate-400 text-xs select-none"
          style={{
            width: `${pageSize.width}px`,
            height: `${pageSize.height}px`,
          }}
        >
          <span className="font-mono text-slate-500">Page {pageNum}</span>
        </div>
      )}

      {/* Page number watermark badge for quick orientation */}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-900/70 backdrop-blur-sm text-[10px] text-slate-300 font-mono pointer-events-none z-10">
        Page {pageNum}
      </div>
    </div>
  );
});
