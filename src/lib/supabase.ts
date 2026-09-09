import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NursingDocument, DocumentType } from '../types';

export const BUCKET_NAME = 'maltese-archive';

// Default / fallback checks
const ENV_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const ENV_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Stored settings in localStorage for seamless connection without container rebuilds
const STORAGE_KEY_URL = 'maltese_supabase_url';
const STORAGE_KEY_ANON = 'maltese_supabase_anon_key';

const isPlaceholder = (val: string) => !val || val.includes('your-project') || val.includes('your-anon');

// If client has no credentials, attempt to sync from server in background
if (typeof window !== 'undefined') {
  try {
    const localUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
    const localKey = localStorage.getItem(STORAGE_KEY_ANON) || '';
    if (!localUrl && !localKey && (!ENV_URL || !ENV_ANON_KEY)) {
      fetch('/api/supabase-creds')
        .then(res => res.json())
        .then(data => {
          if (data.url && data.anonKey) {
            saveSupabaseCredentials(data.url, data.anonKey);
            // Re-initialize client if needed
            supabaseInstance = null;
          }
        })
        .catch(() => {});
    }
  } catch {}
}

export function getActiveSupabaseCredentials(): { url: string; anonKey: string } {
  // 1. Production environment configuration (baked in at build time)
  let url = !isPlaceholder(ENV_URL) ? ENV_URL : '';
  let anonKey = !isPlaceholder(ENV_ANON_KEY) ? ENV_ANON_KEY : '';

  // 2. Fallback to localStorage if environment variables are not yet injected
  if (!url || !anonKey) {
    if (typeof window !== 'undefined') {
      const localUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
      const localKey = localStorage.getItem(STORAGE_KEY_ANON) || '';
      if (!url && !isPlaceholder(localUrl)) url = localUrl;
      if (!anonKey && !isPlaceholder(localKey)) anonKey = localKey;
    }
  }

  return { url, anonKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    try {
      fetch('/api/sync-supabase-creds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }),
      }).catch(() => {});
    } catch {}
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
  }
}

// Auto-sync credentials from localStorage to project environment files if in development
if (typeof window !== 'undefined') {
  try {
    const localUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
    const localKey = localStorage.getItem(STORAGE_KEY_ANON) || '';
    if (localUrl && localKey && (!ENV_URL || !ENV_ANON_KEY)) {
      fetch('/api/sync-supabase-creds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: localUrl, anonKey: localKey }),
      }).catch(() => {});
    }
  } catch {}
}

const initialCredentials = getActiveSupabaseCredentials();

// Initialize Supabase automatically when the website loads
export const supabase: SupabaseClient | null = (initialCredentials.url && initialCredentials.anonKey)
  ? createClient(initialCredentials.url, initialCredentials.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  if (supabase) {
    return supabase;
  }

  const { url, anonKey } = getActiveSupabaseCredentials();

  if (!url || !anonKey) {
    return null;
  }

  // Create new client if not exists or if URL changed
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }

  return supabaseInstance;
}

export function resetSupabaseInstance(): void {
  supabaseInstance = null;
}

// Generate unique 6-character hex file ID
export function generateUniqueFileId(): string {
  const randomBytes = new Uint8Array(3);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Program code mapper (e.g. "BS Nursing" -> "BSN")
export function getProgramCode(programName: string): string {
  const trimmed = programName.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized.includes('bs') || normalized.includes('bachelor') || normalized === 'bsn') {
    return 'BSN';
  }
  if (normalized.includes('ms') || normalized.includes('master') || normalized === 'msn') {
    return 'MSN';
  }
  if (normalized.includes('dnp') || normalized.includes('doctor of nursing practice')) {
    return 'DNP';
  }
  if (normalized.includes('phd')) {
    return 'PhD';
  }
  // Sanitize fallback: uppercase alphanumeric
  return trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'NURS';
}

// Automatic folder path builder according to prompt requirements:
// theses/{academic_year}/{program}/{unique_file_id}.pdf
// gcps/{academic_year}/{program}/{unique_file_id}.pdf
export function constructStoragePath(
  documentType: DocumentType,
  academicYear: string,
  program: string,
  fileId?: string
): string {
  const typeFolder = documentType === 'Thesis' ? 'theses' : 'gcps';
  const cleanYear = academicYear.trim();
  const programCode = getProgramCode(program);
  const id = fileId || generateUniqueFileId();

  return `${typeFolder}/${cleanYear}/${programCode}/${id}.pdf`;
}

/**
 * Normalizes a storage path, removing leading slashes, full URLs, query parameters,
 * or accidental bucket prefixes, ensuring a clean relative object path (e.g. 'gcps/2025/BSN/5bc0d4.pdf').
 */
export function normalizeStoragePath(storagePath: string): string {
  if (!storagePath) return '';
  let clean = storagePath.trim();

  // If full URL was provided, extract the path after storage endpoint or bucket name
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const urlObj = new URL(clean);
      const pathname = urlObj.pathname;
      // Match standard Supabase storage endpoints: /storage/v1/object/(public|sign|authenticated)/[bucket]/[path...]
      const storageRegex = /\/storage\/v1\/object\/(?:public|sign|authenticated)?\/?([^/]+)\/(.+)$/;
      const match = pathname.match(storageRegex);
      if (match && match[2]) {
        clean = decodeURIComponent(match[2]);
      } else {
        const marker = `/${BUCKET_NAME}/`;
        const idx = pathname.indexOf(marker);
        if (idx !== -1) {
          clean = decodeURIComponent(pathname.substring(idx + marker.length));
        } else {
          const parts = pathname.split('/').filter(Boolean);
          const bIdx = parts.indexOf(BUCKET_NAME);
          if (bIdx !== -1 && bIdx < parts.length - 1) {
            clean = decodeURIComponent(parts.slice(bIdx + 1).join('/'));
          }
        }
      }
    } catch {
      // ignore parsing error
    }
  }

  // Remove any query parameters or hash
  clean = clean.split('?')[0].split('#')[0];

  // Strip leading slashes
  clean = clean.replace(/^\/+/, '');

  // Strip bucket prefix if repeated (e.g. 'maltese-archive/gcps/...')
  if (clean.startsWith(`${BUCKET_NAME}/`)) {
    clean = clean.substring(BUCKET_NAME.length + 1);
  }

  // Strip any other accidental bucket prefixes that might have been prepended
  for (const wrong of ['documents/', 'uploads/', 'gcps-bucket/']) {
    if (clean.startsWith(wrong) && !clean.startsWith('gcps/')) {
      clean = clean.substring(wrong.length);
    }
  }

  return clean.replace(/^\/+/, '');
}

/**
 * Get public URL for a storage path in 'maltese-archive' bucket.
 * Uses: supabase.storage.from('maltese-archive').getPublicUrl(cleanPath)
 * Falls back to local same-origin proxy if Supabase client is not ready.
 */
export function getDocumentPublicUrl(storagePath: string): string {
  if (!storagePath) return '';
  const cleanPath = normalizeStoragePath(storagePath);
  if (!cleanPath) return '';

  const supabase = getSupabase();
  if (supabase) {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(cleanPath);
    if (data?.publicUrl) return data.publicUrl;
  }
  // Robust fallback: same-origin proxy
  return `/api/pdf-proxy?path=${encodeURIComponent(cleanPath)}`;
}

/**
 * Get the preview/viewing URL for a storage path in 'maltese-archive' bucket.
 * For public buckets, uses supabase.storage.from('maltese-archive').getPublicUrl(cleanPath)
 * to avoid NoSuchBucket errors caused by calling createSignedUrl on public buckets.
 */
export async function getDocumentViewUrl(
  storagePath: string,
  _expiresInSeconds?: number
): Promise<string> {
  return getDocumentPublicUrl(storagePath);
}

/**
 * Downloads the PDF directly from the 'maltese-archive' bucket via Supabase Storage
 * and creates a local browser blob URL. Serves as a robust in-browser fallback for canvas
 * rendering in case of cross-origin or canvas worker limitations.
 */
export async function getDocumentBlobUrl(storagePath: string): Promise<string> {
  if (!storagePath) return '';
  const cleanPath = normalizeStoragePath(storagePath);
  if (!cleanPath) return '';

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(cleanPath);
      if (!error && data) {
        return URL.createObjectURL(data);
      }
      if (error) {
        console.warn('storage.download warning:', error.message);
      }
    } catch (err) {
      console.warn('getDocumentBlobUrl exception:', err);
    }
  }

  // Fallback: download via same-origin PDF proxy
  try {
    const res = await fetch(`/api/pdf-proxy?path=${encodeURIComponent(cleanPath)}`);
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (proxyErr) {
    console.warn('PDF proxy blob fallback error:', proxyErr);
  }

  return '';
}

// Clean up / delete orphaned or replaced storage file
export async function deleteStorageFile(storagePath: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !storagePath) return false;
  const cleanPath = normalizeStoragePath(storagePath);
  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([cleanPath]);
    if (error) {
      console.warn('Could not remove file from storage:', storagePath, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Storage delete exception:', err);
    return false;
  }
}

export interface RoleVerificationResult {
  isAdmin: boolean;
  role: string | null;
  userId?: string;
  error?: string;
  errorCode?: string;
  errorDetails?: string;
  errorHint?: string;
  rawData?: any;
}

// Check if a specific user has the 'admin' role by directly querying public.user_roles
export async function verifyAdminRoleInDatabase(user: any): Promise<RoleVerificationResult> {
  const supabase = getSupabase();
  if (!supabase || !user?.id) {
    return { isAdmin: false, role: null, error: 'No active Supabase client or authenticated user session.' };
  }

  try {
    // 1. Strictly query public.user_roles where user_id matches user.id (which is auth.uid())
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Error querying public.user_roles:', error);
      return {
        isAdmin: false,
        role: null,
        userId: user.id,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
      };
    }

    if (!data) {
      return {
        isAdmin: false,
        role: null,
        userId: user.id,
        error: `No record found in public.user_roles for user_id: "${user.id}" (0 rows returned).`,
        rawData: null,
      };
    }

    const role = (data.role || '').toLowerCase().trim();
    const isAdmin = role === 'admin';

    return {
      isAdmin,
      role: data.role,
      userId: data.user_id || user.id,
      rawData: data,
    };
  } catch (err: any) {
    console.error('Exception querying public.user_roles:', err);
    return {
      isAdmin: false,
      role: null,
      userId: user?.id,
      error: err.message || 'Unexpected error checking role.',
    };
  }
}

// SQL setup script for user's convenience
export const SUPABASE_SETUP_SQL = `-- Maltese Archive Database & Secure Admin Authorization Setup Script
-- Run this in your Supabase project's SQL Editor (supabase.com/dashboard/project/.../sql)

-- 1. Enable Row Level Security on public.user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Allow authenticated users to SELECT ONLY their own role
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Security Definer function to verify admin role from public.user_roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 4. Enable Row Level Security on documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4b. Duplicate Detection: Add file_hash column and index for fast exact-duplicate lookups
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_hash text;
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON public.documents (file_hash);

-- 5. Row Level Security policies for 'documents' table
-- Public can browse and read documents
DROP POLICY IF EXISTS "Public users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Public read documents" ON public.documents;
CREATE POLICY "Public read documents"
  ON public.documents
  FOR SELECT
  USING (true);

-- Only authenticated users with admin role in public.user_roles can insert
DROP POLICY IF EXISTS "Only admins can insert documents" ON public.documents;
CREATE POLICY "Only admins can insert documents"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only authenticated users with admin role in public.user_roles can update
DROP POLICY IF EXISTS "Only admins can update documents" ON public.documents;
CREATE POLICY "Only admins can update documents"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only authenticated users with admin role in public.user_roles can delete
DROP POLICY IF EXISTS "Only admins can delete documents" ON public.documents;
CREATE POLICY "Only admins can delete documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 6. Create the 'maltese-archive' storage bucket (if not already created)
INSERT INTO storage.buckets (id, name, public)
VALUES ('maltese-archive', 'maltese-archive', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Storage Policies for 'maltese-archive' bucket
DROP POLICY IF EXISTS "Public users can view documents in maltese-archive" ON storage.objects;
DROP POLICY IF EXISTS "Public can view maltese-archive documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read maltese-archive" ON storage.objects;
CREATE POLICY "Public read maltese-archive"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'maltese-archive');

DROP POLICY IF EXISTS "Authenticated users can upload to maltese-archive" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload to maltese-archive" ON storage.objects;
CREATE POLICY "Only admins can upload to maltese-archive"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'maltese-archive' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can update files in maltese-archive" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update maltese-archive" ON storage.objects;
CREATE POLICY "Only admins can update maltese-archive"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'maltese-archive' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can delete files in maltese-archive" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete in maltese-archive" ON storage.objects;
CREATE POLICY "Only admins can delete in maltese-archive"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'maltese-archive' AND public.is_admin());
`;
