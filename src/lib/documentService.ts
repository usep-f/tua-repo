import {
  getSupabase,
  BUCKET_NAME,
  constructStoragePath,
  deleteStorageFile,
  getDocumentPublicUrl,
  getDocumentViewUrl,
  generateUniqueFileId,
} from './supabase';
import { NursingDocument, DocumentUploadPayload, DocumentUpdatePayload, RepositoryFilters, DocumentType } from '../types';
import { calculateFileSha256 } from './duplicateDetection';
import { preIndexUploadedDocument } from './pdfSearch';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RepositoryStats {
  totalDocuments: number;
  totalTheses: number;
  totalGCPs: number;
  academicYearsCount: number;
  years: string[];
}

// Fetch documents with filtering, search, sorting, and pagination
export async function fetchDocuments(
  filters: RepositoryFilters,
  pageSize: number = 6
): Promise<PaginatedResult<NursingDocument>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: [], total: 0, page: filters.page, pageSize, totalPages: 0 };
  }

  let query = supabase.from('documents').select('*', { count: 'exact' });

  // Academic year filter
  if (filters.academicYear && filters.academicYear !== 'All') {
    query = query.eq('academic_year', filters.academicYear);
  }

  // Document type filter
  if (filters.documentType && filters.documentType !== 'All') {
    query = query.eq('document_type', filters.documentType);
  }

  // Program filter
  if (filters.program && filters.program !== 'All') {
    query = query.eq('program', filters.program);
  }

  // Category filter
  if (filters.category && filters.category !== 'All') {
    query = query.eq('category', filters.category);
  }

  // Text search across title, authors, keywords, and description
  if (filters.query && filters.query.trim() !== '') {
    const q = filters.query.trim();
    query = query.or(
      `title.ilike.%${q}%,authors.ilike.%${q}%,keywords.ilike.%${q}%,description.ilike.%${q}%`
    );
  }

  // Sorting
  switch (filters.sortBy) {
    case 'oldest':
      query = query.order('uploaded_at', { ascending: true });
      break;
    case 'title_asc':
      query = query.order('title', { ascending: true });
      break;
    case 'title_desc':
      query = query.order('title', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('uploaded_at', { ascending: false });
      break;
  }

  // Pagination bounds
  const from = (filters.page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    throw new Error(`Failed to load repository: ${error.message}`);
  }

  const documents = (data || []).map((doc: any) => {
    const docPath = doc.storage_path || doc.file_path || doc.file_url || '';
    const publicUrl = docPath ? getDocumentPublicUrl(docPath) : (doc.public_url || '');
    return {
      ...doc,
      storage_path: docPath,
      file_path: docPath,
      public_url: publicUrl,
    };
  }) as NursingDocument[];

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    data: documents,
    total,
    page: filters.page,
    pageSize,
    totalPages,
  };
}

// Fetch single document by ID
export async function fetchDocumentById(id: string): Promise<NursingDocument | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching document by ID:', error);
    return null;
  }

  const docPath = data.storage_path || data.file_path || data.file_url || '';
  const publicUrl = docPath ? getDocumentPublicUrl(docPath) : (data.public_url || '');

  return {
    ...data,
    storage_path: docPath,
    file_path: docPath,
    public_url: publicUrl,
  } as NursingDocument;
}

// Fetch repository stats for dashboard and landing page
export async function fetchRepositoryStats(): Promise<RepositoryStats> {
  const supabase = getSupabase();
  if (!supabase) {
    return { totalDocuments: 0, totalTheses: 0, totalGCPs: 0, academicYearsCount: 0, years: [] };
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('academic_year, document_type');

    if (error || !data) {
      return { totalDocuments: 0, totalTheses: 0, totalGCPs: 0, academicYearsCount: 0, years: [] };
    }

    const totalDocuments = data.length;
    let totalTheses = 0;
    let totalGCPs = 0;
    const yearSet = new Set<string>();

    data.forEach(item => {
      if (item.document_type === 'Thesis') totalTheses++;
      if (item.document_type === 'Grand Case Presentation') totalGCPs++;
      if (item.academic_year) yearSet.add(item.academic_year);
    });

    const years = Array.from(yearSet).sort().reverse();

    return {
      totalDocuments,
      totalTheses,
      totalGCPs,
      academicYearsCount: yearSet.size,
      years,
    };
  } catch (err) {
    console.error('Error in fetchRepositoryStats:', err);
    return { totalDocuments: 0, totalTheses: 0, totalGCPs: 0, academicYearsCount: 0, years: [] };
  }
}

// Fetch recent documents for homepage
export async function fetchRecentDocuments(limit: number = 4): Promise<NursingDocument[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const documents = data.map(doc => {
    const docPath = doc.storage_path || doc.file_path || doc.file_url || '';
    const publicUrl = docPath ? getDocumentPublicUrl(docPath) : (doc.public_url || '');
    return {
      ...doc,
      storage_path: docPath,
      file_path: docPath,
      public_url: publicUrl,
    };
  });

  return documents as NursingDocument[];
}

// Helper to format Supabase errors nicely, preserving the exact PostgreSQL / RLS details
function formatSupabaseError(error: any, defaultMsg: string): Error {
  const msg = error?.message || (typeof error === 'string' ? error : '');
  const code = error?.code ? ` [Code: ${error.code}]` : '';
  const details = error?.details ? ` (Details: ${error.details})` : '';
  const hint = error?.hint ? ` (Hint: ${error.hint})` : '';
  const fullError = `${msg}${code}${details}${hint}`.trim() || 'Unknown error occurred.';

  if (
    msg.toLowerCase().includes('violates row-level security') ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('permission denied')
  ) {
    return new Error(
      `Administrator authorization required: This action was blocked by Supabase Row Level Security. Reason: ${fullError}`
    );
  }
  return new Error(`${defaultMsg}: ${fullError}`);
}

// Real upload document operation with automatic folder structure and rollback
export async function uploadDocument(
  payload: DocumentUploadPayload,
  uploadedByUserId?: string,
  onProgress?: (percent: number) => void
): Promise<NursingDocument> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client is not connected. Please verify connection credentials.');
  }

  const { file, title, authors, academic_year, document_type, program, category, keywords, description } = payload;

  // 1. Validation
  if (!file) throw new Error('Please select a PDF file to upload.');
  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    throw new Error('Invalid file format. Only standard PDF files (.pdf) are permitted.');
  }

  // 50MB Max limit check
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`The selected PDF exceeds the 50MB size limit (file size: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
  }

  if (!title.trim()) throw new Error('Document title is required.');
  if (!authors.trim()) throw new Error('Authors field is required.');
  if (!academic_year.trim()) throw new Error('Academic Year is required.');
  if (!program.trim()) throw new Error('Academic Program is required.');
  if (!category.trim()) throw new Error('Clinical/Academic Category is required.');

  // 2. Retrieve authenticated Supabase user UUID to ensure uploaded_by is always a valid auth.users UUID
  let userId = uploadedByUserId;
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser();
    userId = authData?.user?.id;
  }

  if (!userId) {
    throw new Error('Authentication required: Unable to retrieve authenticated user ID (UUID) for uploaded_by.');
  }

  // 3. Compute cryptographic SHA-256 hash if not already provided
  let fileHash = payload.file_hash;
  if (!fileHash && file) {
    try {
      fileHash = await calculateFileSha256(file);
    } catch (hashErr) {
      console.warn('Could not compute SHA-256 for document file:', hashErr);
    }
  }

  // 4. Generate unique file ID and construct automatic path
  const uniqueId = generateUniqueFileId();
  const storagePath = constructStoragePath(document_type, academic_year, program, uniqueId);

  onProgress?.(25);

  // 5. Upload actual PDF file to Supabase Storage
  const { data: storageData, error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (storageError) {
    console.error('Supabase Storage upload error:', storageError);
    throw formatSupabaseError(
      storageError,
      `Storage upload failed: ${storageError.message}. Make sure bucket '${BUCKET_NAME}' exists and policies are applied.`
    );
  }

  onProgress?.(70);

  // 6. Save metadata and storage path into 'documents' table using user's UUID
  const insertPayload: Record<string, any> = {
    title: title.trim(),
    authors: authors.trim(),
    academic_year: academic_year.trim(),
    document_type,
    program: program.trim(),
    category: category.trim(),
    keywords: keywords.trim(),
    description: description.trim(),
    file_name: file.name,
    storage_path: storagePath,
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
  };

  if (fileHash) {
    insertPayload.file_hash = fileHash;
  }

  let { data: dbData, error: dbError } = await supabase
    .from('documents')
    .insert([insertPayload])
    .select()
    .single();

  // If column file_hash does not exist in the database table (Postgres error 42703), retry without it!
  if (dbError && (dbError.code === '42703' || dbError.message?.includes('file_hash'))) {
    console.warn('Database table documents does not have file_hash column yet. Retrying insert without file_hash.');
    delete insertPayload.file_hash;
    const retryResult = await supabase
      .from('documents')
      .insert([insertPayload])
      .select()
      .single();
    dbData = retryResult.data;
    dbError = retryResult.error;
  }

  if (dbError) {
    console.error('Database insertion error, initiating rollback:', dbError);
    // CRITICAL: Cleanup uploaded file if DB insertion fails to prevent orphaned files
    await deleteStorageFile(storagePath);
    throw formatSupabaseError(dbError, 'Database error saving metadata. File upload rolled back');
  }

  onProgress?.(100);

  const docPath = dbData.storage_path || dbData.file_path || storagePath;
  const publicUrl = getDocumentPublicUrl(docPath);

  // Trigger non-blocking background pre-indexing so searchable index & OCR are ready immediately
  preIndexUploadedDocument(file, docPath, dbData.file_name || file.name).catch(err => {
    console.warn('Document upload pre-indexing notice:', err);
  });

  return {
    ...dbData,
    storage_path: docPath,
    file_path: docPath,
    public_url: publicUrl,
  } as NursingDocument;
}

// Update existing document metadata
export async function updateDocumentMetadata(
  id: string,
  payload: DocumentUpdatePayload
): Promise<NursingDocument> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client not connected');

  const { data, error } = await supabase
    .from('documents')
    .update({
      title: payload.title.trim(),
      authors: payload.authors.trim(),
      academic_year: payload.academic_year.trim(),
      document_type: payload.document_type,
      program: payload.program.trim(),
      category: payload.category.trim(),
      keywords: payload.keywords.trim(),
      description: payload.description.trim(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update metadata: ${error.message}`);
  }

  let viewUrl = '';
  try {
    viewUrl = await getDocumentViewUrl(data.storage_path);
  } catch {
    viewUrl = getDocumentPublicUrl(data.storage_path);
  }

  return {
    ...data,
    public_url: viewUrl || getDocumentPublicUrl(data.storage_path),
  } as NursingDocument;
}

// Replace PDF of an existing document
export async function replaceDocumentPdf(
  documentId: string,
  oldStoragePath: string,
  newFile: File,
  documentType: DocumentType,
  academicYear: string,
  program: string
): Promise<NursingDocument> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client not connected');

  if (!newFile.name.toLowerCase().endsWith('.pdf') || newFile.type !== 'application/pdf') {
    throw new Error('Replacement file must be a valid PDF format.');
  }

  // Generate new unique ID & automatic path
  const newUniqueId = generateUniqueFileId();
  const newStoragePath = constructStoragePath(documentType, academicYear, program, newUniqueId);

  // 1. Calculate SHA-256 hash of the replacement file
  let newFileHash: string | undefined;
  try {
    newFileHash = await calculateFileSha256(newFile);
  } catch (hashErr) {
    console.warn('Could not compute SHA-256 for replacement file:', hashErr);
  }

  // 2. Upload new file first
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(newStoragePath, newFile, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`Failed to upload replacement PDF: ${uploadErr.message}`);
  }

  // 3. Update database record with new file name, storage path, and new file_hash
  const updateData: Record<string, any> = {
    file_name: newFile.name,
    storage_path: newStoragePath,
  };
  if (newFileHash) {
    updateData.file_hash = newFileHash;
  }

  let { data: updatedDoc, error: dbErr } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', documentId)
    .select()
    .single();

  // If column file_hash does not exist in the database table (Postgres error 42703), retry without it!
  if (dbErr && (dbErr.code === '42703' || dbErr.message?.includes('file_hash'))) {
    console.warn('Database table documents does not have file_hash column yet. Retrying replace update without file_hash.');
    delete updateData.file_hash;
    const retryResult = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();
    updatedDoc = retryResult.data;
    dbErr = retryResult.error;
  }

  if (dbErr) {
    // Rollback: delete the newly uploaded file
    await deleteStorageFile(newStoragePath);
    throw new Error(`Failed to update database with new file: ${dbErr.message}. Replacement rolled back.`);
  }

  // 3. Only after new upload and DB update succeed, delete the old file
  if (oldStoragePath && oldStoragePath !== newStoragePath) {
    await deleteStorageFile(oldStoragePath);
  }

  const docPath = updatedDoc.storage_path || updatedDoc.file_path || newStoragePath;
  const publicUrl = getDocumentPublicUrl(docPath);

  return {
    ...updatedDoc,
    storage_path: docPath,
    file_path: docPath,
    public_url: publicUrl,
  } as NursingDocument;
}

// Delete document and its PDF from Storage
export async function deleteDocument(documentId: string, storagePath: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client not connected');

  // 1. Delete from database first
  const { error: dbErr } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (dbErr) {
    throw new Error(`Failed to delete document from database: ${dbErr.message}`);
  }

  // 2. Delete the actual file from Supabase Storage
  if (storagePath) {
    await deleteStorageFile(storagePath);
  }
}
