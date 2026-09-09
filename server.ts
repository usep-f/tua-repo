import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import Tesseract from 'tesseract.js';

dotenv.config();

// Helper to sanitize document keys for directory storage
function getCleanDocKey(docKey: string): string {
  const normalized = (docKey || 'default_doc')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const hash = crypto.createHash('sha256').update(docKey || 'default').digest('hex').substring(0, 16);
  return `${normalized.substring(0, 40)}_${hash}`;
}

// Lazy initialization for GoogleGenAI
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Persistent on-disk OCR cache directory
const OCR_CACHE_DIR = path.join(process.cwd(), '.cache', 'ocr');
const INDEX_CACHE_DIR = path.join(process.cwd(), '.cache', 'indices');
try {
  fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
  fs.mkdirSync(INDEX_CACHE_DIR, { recursive: true });
} catch {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers with 25MB limit to allow base64 page images
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Supabase credential retrieval endpoint (enables mobile devices to connect seamlessly)
  app.get('/api/supabase-creds', (req, res) => {
    const url = process.env.VITE_SUPABASE_URL || '';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    res.json({ url, anonKey });
  });

  // 2a. Retrieve pre-built Searchable Text Index for a document
  // Fast, lightweight JSON retrieval (<50ms) so mobile devices never run OCR locally
  app.get('/api/document-index', async (req, res) => {
    try {
      const docKey = req.query.docKey as string;
      if (!docKey) {
        return res.status(400).json({ error: 'Missing docKey' });
      }

      const cleanKey = getCleanDocKey(docKey);
      const indexFilePath = path.join(INDEX_CACHE_DIR, `${cleanKey}.json`);

      // 1. Check local persistent disk index
      if (fs.existsSync(indexFilePath)) {
        try {
          const content = fs.readFileSync(indexFilePath, 'utf-8');
          const parsed = JSON.parse(content);
          return res.json({ success: true, index: parsed });
        } catch (e) {
          console.warn('Corrupted local index file, rebuilding:', e);
        }
      }

      // 2. Check individual OCR pages folder and assemble if available
      const docCacheFolder = path.join(OCR_CACHE_DIR, cleanKey);
      if (fs.existsSync(docCacheFolder)) {
        const files = fs.readdirSync(docCacheFolder);
        const pages: Record<number, { pageNum: number; text: string; isOcr: boolean }> = {};
        let totalPages = 0;

        for (const file of files) {
          if (file.endsWith('.json')) {
            const pageNum = parseInt(file.replace('.json', ''), 10);
            if (!isNaN(pageNum)) {
              try {
                const content = fs.readFileSync(path.join(docCacheFolder, file), 'utf-8');
                const parsed = JSON.parse(content);
                pages[pageNum] = {
                  pageNum,
                  text: parsed.text || '',
                  isOcr: true,
                };
                if (pageNum > totalPages) totalPages = pageNum;
              } catch {}
            }
          }
        }

        if (Object.keys(pages).length > 0) {
          const assembledIndex = {
            docKey,
            totalPages,
            isScanned: true,
            hasOcr: true,
            pages,
            indexedAt: Date.now(),
          };
          // Persist assembled index
          try {
            fs.writeFileSync(indexFilePath, JSON.stringify(assembledIndex));
          } catch {}
          return res.json({ success: true, index: assembledIndex });
        }
      }

      // 3. Check Supabase Storage bucket for pre-uploaded index
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        try {
          const remoteIndexUrl = `${supabaseUrl}/storage/v1/object/public/maltese-archive/indices/${cleanKey}.json`;
          const resp = await fetch(remoteIndexUrl);
          if (resp.ok) {
            const remoteIndex = await resp.json();
            try {
              fs.writeFileSync(indexFilePath, JSON.stringify(remoteIndex));
            } catch {}
            return res.json({ success: true, index: remoteIndex });
          }
        } catch {}
      }

      return res.json({ success: false, found: false });
    } catch (err: any) {
      console.error('Error fetching document index:', err);
      res.status(500).json({ error: 'Failed to fetch document index' });
    }
  });

  // 2b. Store Searchable Text Index for a document (called after upload or initial indexing)
  app.post('/api/document-index', async (req, res) => {
    try {
      const { docKey, totalPages, isScanned, hasOcr, pages } = req.body || {};
      if (!docKey || !pages) {
        return res.status(400).json({ error: 'Missing docKey or pages payload' });
      }

      const cleanKey = getCleanDocKey(docKey);
      const indexFilePath = path.join(INDEX_CACHE_DIR, `${cleanKey}.json`);

      const indexData = {
        docKey,
        totalPages: totalPages || Object.keys(pages).length,
        isScanned: !!isScanned,
        hasOcr: !!hasOcr,
        pages,
        indexedAt: Date.now(),
      };

      // 1. Write to server disk cache
      fs.writeFileSync(indexFilePath, JSON.stringify(indexData));

      // 2. Also back up individual page OCR files if OCR is present
      if (hasOcr || isScanned) {
        const docCacheFolder = path.join(OCR_CACHE_DIR, cleanKey);
        try {
          fs.mkdirSync(docCacheFolder, { recursive: true });
          for (const [pStr, pData] of Object.entries(pages as Record<string, any>)) {
            if (pData && pData.text) {
              const pageFile = path.join(docCacheFolder, `${pStr}.json`);
              if (!fs.existsSync(pageFile)) {
                fs.writeFileSync(
                  pageFile,
                  JSON.stringify({
                    pageNum: Number(pStr),
                    text: pData.text,
                    engine: 'indexed',
                    timestamp: Date.now(),
                  })
                );
              }
            }
          }
        } catch {}
      }

      // 3. Sync to Supabase Storage if credentials are available
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const uploadUrl = `${supabaseUrl}/storage/v1/object/maltese-archive/indices/${cleanKey}.json`;
          fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
              'x-upsert': 'true',
            },
            body: JSON.stringify(indexData),
          }).catch(() => {});
        } catch {}
      }

      res.json({ success: true, cleanKey, pagesCount: Object.keys(pages).length });
    } catch (err: any) {
      console.error('Error saving document index:', err);
      res.status(500).json({ error: 'Failed to save document index' });
    }
  });

  // 2c. Retrieve all cached OCR pages for a document
  app.get('/api/ocr-document', (req, res) => {
    try {
      const docKey = req.query.docKey as string;
      if (!docKey) {
        return res.status(400).json({ error: 'Missing docKey' });
      }

      const cleanKey = getCleanDocKey(docKey);
      const docCacheFolder = path.join(OCR_CACHE_DIR, cleanKey);
      if (!fs.existsSync(docCacheFolder)) {
        return res.json({ cachedPages: {} });
      }

      const files = fs.readdirSync(docCacheFolder);
      const cachedPages: Record<number, { text: string; lines?: any[]; isOcr: boolean }> = {};

      for (const file of files) {
        if (file.endsWith('.json')) {
          const pageNum = parseInt(file.replace('.json', ''), 10);
          if (!isNaN(pageNum)) {
            try {
              const content = fs.readFileSync(path.join(docCacheFolder, file), 'utf-8');
              const parsed = JSON.parse(content);
              cachedPages[pageNum] = {
                text: parsed.text || '',
                lines: parsed.lines || [],
                isOcr: true,
              };
            } catch {}
          }
        }
      }

      res.json({ cachedPages });
    } catch (err: any) {
      console.error('Error reading OCR document cache:', err);
      res.status(500).json({ error: 'Failed to read OCR document cache' });
    }
  });

  // 2c. OCR a single page image (Gemini Vision with local Tesseract fallback)
  app.post('/api/ocr-page', async (req, res) => {
    try {
      const { docKey, pageNum, imageBase64, mimeType = 'image/jpeg' } = req.body || {};
      if (!imageBase64 || !pageNum) {
        return res.status(400).json({ error: 'Missing imageBase64 or pageNum' });
      }

      const cleanKey = getCleanDocKey(docKey || 'unnamed');
      const docCacheFolder = path.join(OCR_CACHE_DIR, cleanKey);
      const pageCacheFile = path.join(docCacheFolder, `${pageNum}.json`);

      // 1. Check disk cache first
      if (fs.existsSync(pageCacheFile)) {
        try {
          const cachedRaw = fs.readFileSync(pageCacheFile, 'utf-8');
          const cachedData = JSON.parse(cachedRaw);
          return res.json({
            success: true,
            pageNum,
            text: cachedData.text || '',
            lines: cachedData.lines || [],
            cached: true,
            engine: cachedData.engine || 'cache',
          });
        } catch {}
      }

      let recognizedText = '';
      let usedEngine = '';

      // 2. Primary Engine: Gemini Vision OCR
      const ai = getGemini();
      if (ai) {
        const candidateModels = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'];
        for (const model of candidateModels) {
          try {
            const prompt =
              'You are a high-accuracy document OCR engine. Transcribe all legible text from this scanned page verbatim, preserving paragraphs, headings, lists, and reading order. Do not invent text, do not add introductory or closing remarks, and do not wrap in markdown backticks. If the page is blank or has no text, respond with [BLANK_PAGE].';

            const response = await ai.models.generateContent({
              model,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: imageBase64,
                      },
                    },
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
            });

            const textOutput = response.text ? response.text.trim() : '';
            if (textOutput === '[BLANK_PAGE]' || textOutput === 'EMPTY') {
              recognizedText = '';
            } else {
              recognizedText = textOutput;
            }
            usedEngine = `gemini (${model})`;
            break;
          } catch (modelErr: any) {
            console.warn(`Gemini OCR model ${model} attempt failed:`, modelErr?.status || modelErr?.message);
          }
        }
      }

      // 3. Fallback Engine: Tesseract.js (runs locally, 100% offline reliability)
      if (!recognizedText && usedEngine === '') {
        try {
          const buffer = Buffer.from(imageBase64, 'base64');
          const tesseractResult = await Tesseract.recognize(buffer, 'eng');
          recognizedText = tesseractResult.data?.text || '';
          usedEngine = 'tesseract';
        } catch (tessErr: any) {
          console.error('Tesseract fallback error:', tessErr?.message);
        }
      }

      // 4. Save to disk cache
      try {
        fs.mkdirSync(docCacheFolder, { recursive: true });
        fs.writeFileSync(
          pageCacheFile,
          JSON.stringify({
            pageNum,
            text: recognizedText,
            lines: [],
            engine: usedEngine,
            timestamp: Date.now(),
          })
        );
      } catch (writeErr) {
        console.warn('Failed to write page OCR cache file:', writeErr);
      }

      res.json({
        success: true,
        pageNum,
        text: recognizedText,
        lines: [],
        cached: false,
        engine: usedEngine || 'none',
      });
    } catch (err: any) {
      console.error('Server OCR error:', err);
      res.status(500).json({ error: `OCR failed: ${err?.message}` });
    }
  });

  // 3. Same-origin PDF streaming proxy to guarantee mobile devices can always load PDFs
  app.get('/api/pdf-proxy', async (req, res) => {
    try {
      const rawUrl = req.query.url as string;
      const pathParam = req.query.path as string;
      let targetUrl = rawUrl;
      if (!targetUrl && pathParam) {
        const baseUrl = process.env.VITE_SUPABASE_URL;
        if (baseUrl) {
          const cleanPath = pathParam.replace(/^\/+/, '').replace(/^maltese-archive\//, '');
          targetUrl = `${baseUrl}/storage/v1/object/public/maltese-archive/${cleanPath}`;
        }
      }
      if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url or path parameter' });
      }

      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch PDF: ${response.statusText}` });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('PDF proxy error:', err);
      res.status(500).json({ error: `Proxy error: ${err?.message}` });
    }
  });

  // 4. Supabase credential synchronization endpoint
  app.post('/api/sync-supabase-creds', (req, res) => {
    try {
      const { url, anonKey } = req.body || {};
      if (url && anonKey) {
        const trimmedUrl = String(url).trim();
        const trimmedKey = String(anonKey).trim();
        const envContent = `VITE_SUPABASE_URL=${trimmedUrl}\nVITE_SUPABASE_ANON_KEY=${trimmedKey}\n`;
        fs.writeFileSync(path.resolve(process.cwd(), '.env'), envContent);
        fs.writeFileSync(path.resolve(process.cwd(), '.env.production'), envContent);
        process.env.VITE_SUPABASE_URL = trimmedUrl;
        process.env.VITE_SUPABASE_ANON_KEY = trimmedKey;
        console.log('✅ Supabase credentials saved to .env & .env.production');
        res.json({ success: true });
        return;
      }
      res.status(400).json({ error: 'Invalid payload' });
    } catch (err: any) {
      console.error('Failed to sync credentials:', err);
      res.status(500).json({ error: 'Failed to write credentials' });
    }
  });

  // Serve public static assets (including same-origin pdf.worker.min.mjs, standard_fonts, and cmaps)
  app.use(
    express.static(path.join(process.cwd(), 'public'), {
      setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'text/javascript');
        }
      },
    })
  );

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The Maltese Archive server running on port ${PORT}`);
  });
}

startServer();
