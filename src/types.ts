export type DocumentType = 'Thesis' | 'Grand Case Presentation';

export type AcademicProgram = 'BS Nursing' | 'MS Nursing' | 'DNP' | 'PhD Nursing' | 'Post-Master\'s Certificate';

export interface NursingDocument {
  id: string;
  title: string;
  authors: string;
  academic_year: string;
  document_type: DocumentType;
  program: string;
  category: string;
  keywords: string;
  description: string;
  file_name: string;
  storage_path: string;
  file_path?: string;
  file_url?: string;
  file_hash?: string;
  uploaded_at: string;
  uploaded_by?: string;
  // Computed or helper fields
  public_url?: string;
}

export interface DocumentUploadPayload {
  title: string;
  authors: string;
  academic_year: string;
  document_type: DocumentType;
  program: string;
  category: string;
  keywords: string;
  description: string;
  file: File;
  file_hash?: string;
}

export type DuplicateSeverity = 'exact' | 'highly_likely' | 'possible';

export interface DuplicateMatch {
  document: NursingDocument;
  similarityScore: number; // 0 - 100
  severity: DuplicateSeverity;
  reasons: string[];
  isExactFile: boolean;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  exactMatch: DuplicateMatch | null;
  matches: DuplicateMatch[];
  fileHash?: string;
}

export interface DocumentUpdatePayload {
  title: string;
  authors: string;
  academic_year: string;
  document_type: DocumentType;
  program: string;
  category: string;
  keywords: string;
  description: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export interface RepositoryFilters {
  query: string;
  academicYear: string;
  documentType: string;
  program: string;
  category: string;
  sortBy: 'newest' | 'oldest' | 'title_asc' | 'title_desc';
  page: number;
}

export interface RecentlyViewedItem {
  documentId: string;
  viewedAt: string; // ISO timestamp
  document: NursingDocument;
}

export type FolderColor =
  | 'amber'
  | 'blue'
  | 'emerald'
  | 'purple'
  | 'rose'
  | 'cyan'
  | 'indigo'
  | 'slate';

export interface BookmarkFolder {
  id: string;
  name: string;
  color: FolderColor;
  createdAt: string;
}

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  contact_number: string | null;
  program: string | null;
  year_level: string | null;
  profile_image_path: string | null;
  created_at?: string;
  updated_at?: string;
}

