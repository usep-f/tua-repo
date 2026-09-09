import { getSupabase, getDocumentPublicUrl } from './supabase';
import { NursingDocument, DuplicateCheckResult, DuplicateMatch, DuplicateSeverity } from '../types';

/**
 * Calculates cryptographic SHA-256 hash of a File or Blob object using browser Web Crypto API.
 * Reads the actual PDF binary bytes into ArrayBuffer and computes SHA-256.
 * Returns lowercase hexadecimal string.
 * Completely client-side, zero network transfer required to compute.
 */
export async function calculateFileSha256(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalizes text for comparison:
 * - Lowercase
 * - Remove common punctuation and symbols
 * - Normalize unicode accents
 * - Collapse repeated spaces and trim
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\w\s]/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts meaningful keyword tokens from normalized text.
 * Filters out common English stop words.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'among', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'under'
]);

export function tokenizeText(normalizedText: string): string[] {
  return normalizedText
    .split(' ')
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Computes Sørensen-Dice coefficient between two strings based on character bigrams.
 * Returns a value between 0 and 1.
 */
export function diceCoefficient(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + (s2.length - 1));
}

/**
 * Computes Jaccard similarity between two token sets.
 * Returns a value between 0 and 1.
 */
export function tokenJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0.0;
}

/**
 * Normalizes author strings by removing academic credentials and titles
 * (RN, BSN, MSN, DNP, PhD, Dr., Adviser, Advising, Prof, etc.)
 */
export function normalizeAuthors(authors: string): string[] {
  const cleaned = authors
    .toLowerCase()
    .replace(/\b(rn|bsn|msn|dnp|phd|md|dr|adviser|advising|advisor|advisors|prof|professor)\b/gi, ' ')
    .replace(/[^\w\s,;]/g, ' ');

  return cleaned
    .split(/[,;]+/)
    .map(name => normalizeText(name))
    .filter(name => name.length > 2);
}

/**
 * Calculates author similarity score between two author strings.
 */
export function compareAuthors(authors1: string, authors2: string): number {
  const norm1 = normalizeAuthors(authors1);
  const norm2 = normalizeAuthors(authors2);

  if (norm1.length === 0 || norm2.length === 0) return 0.0;

  let matched = 0;
  for (const a1 of norm1) {
    const a1Tokens = tokenizeText(a1);
    for (const a2 of norm2) {
      const a2Tokens = tokenizeText(a2);
      const jaccard = tokenJaccardSimilarity(a1Tokens, a2Tokens);
      const dice = diceCoefficient(a1, a2);
      if (jaccard >= 0.6 || dice >= 0.7) {
        matched++;
        break;
      }
    }
  }

  return matched / Math.max(norm1.length, norm2.length);
}

export interface CheckExactDuplicateResult {
  isDuplicate: boolean;
  matchedDocument: NursingDocument | null;
}

/**
 * CHECK A: Exact File Duplicate Check using SHA-256 hash.
 * Directly queries Supabase `documents.file_hash`.
 * Does NOT require title, authors, year, or any other metadata.
 *
 * Excludes `excludeDocumentId` if provided (e.g. when replacing a document, so it does not flag against itself).
 * Handles legacy documents with NULL file_hash safely by inspecting their storage blob on demand.
 */
export async function checkExactFileDuplicate(
  fileHash: string,
  excludeDocumentId?: string
): Promise<CheckExactDuplicateResult> {
  const supabase = getSupabase();
  if (!supabase || !fileHash) {
    return { isDuplicate: false, matchedDocument: null };
  }

  const cleanHash = fileHash.toLowerCase().trim();

  // 1. Direct query against public.documents where file_hash = cleanHash
  let query = supabase
    .from('documents')
    .select('*')
    .eq('file_hash', cleanHash);

  if (excludeDocumentId) {
    query = query.neq('id', excludeDocumentId);
  }

  const { data: exactDocs, error } = await query;

  if (!error && exactDocs && exactDocs.length > 0) {
    const rawDoc = exactDocs[0];
    const docPath = rawDoc.storage_path || rawDoc.file_path || '';
    const nursingDoc: NursingDocument = {
      ...rawDoc,
      storage_path: docPath,
      file_path: docPath,
      public_url: docPath ? getDocumentPublicUrl(docPath) : '',
    };
    return { isDuplicate: true, matchedDocument: nursingDoc };
  }

  // 2. Safe Legacy Fallback: Check older documents where file_hash IS NULL
  // Older documents uploaded before the file_hash column was introduced will have file_hash = NULL.
  // We inspect their storage file in maltese-archive and backfill their hash if identical.
  try {
    let nullQuery = supabase
      .from('documents')
      .select('id, title, authors, academic_year, document_type, program, category, keywords, description, file_name, storage_path, file_hash, uploaded_at')
      .is('file_hash', null);

    if (excludeDocumentId) {
      nullQuery = nullQuery.neq('id', excludeDocumentId);
    }

    const { data: nullDocs } = await nullQuery;

    if (nullDocs && nullDocs.length > 0) {
      for (const legacyDoc of nullDocs) {
        if (!legacyDoc.storage_path) continue;
        try {
          const { data: blobData, error: downloadErr } = await supabase
            .storage
            .from('maltese-archive')
            .download(legacyDoc.storage_path);

          if (!downloadErr && blobData) {
            const legacyHash = await calculateFileSha256(blobData);

            // Backfill the legacy document in the background so future lookups are instant
            Promise.resolve(
              supabase
                .from('documents')
                .update({ file_hash: legacyHash })
                .eq('id', legacyDoc.id)
            ).catch(() => {});

            if (legacyHash === cleanHash) {
              const docPath = legacyDoc.storage_path;
              const nursingDoc: NursingDocument = {
                ...legacyDoc,
                file_hash: legacyHash,
                storage_path: docPath,
                file_path: docPath,
                public_url: docPath ? getDocumentPublicUrl(docPath) : '',
              };
              return { isDuplicate: true, matchedDocument: nursingDoc };
            }
          }
        } catch (err) {
          // Non-blocking: continue checking remaining legacy items
        }
      }
    }
  } catch (nullCheckErr) {
    console.warn('Legacy null hash check encountered non-fatal error:', nullCheckErr);
  }

  return { isDuplicate: false, matchedDocument: null };
}

export interface CheckMetadataParams {
  title: string;
  authors?: string;
  academicYear?: string;
  documentType?: string;
  program?: string;
  excludeDocumentId?: string;
  excludeDocIdFromExact?: string;
}

/**
 * CHECK B: Metadata Similarity Check.
 * Analyzes title, authors, academic year, and program similarity.
 * Runs independently from file hash checking.
 */
export async function checkMetadataDuplicates(
  params: CheckMetadataParams
): Promise<DuplicateMatch[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    title,
    authors = '',
    academicYear = '',
    documentType = '',
    program = '',
    excludeDocumentId,
    excludeDocIdFromExact,
  } = params;

  const normInputTitle = normalizeText(title);
  if (normInputTitle.length < 4) return [];

  const inputTitleTokens = tokenizeText(normInputTitle);

  let query = supabase.from('documents').select('*');
  if (excludeDocumentId) {
    query = query.neq('id', excludeDocumentId);
  }

  const { data: documents, error } = await query;
  if (error || !documents) {
    return [];
  }

  const matches: DuplicateMatch[] = [];

  for (const doc of documents) {
    // Skip if this document was already identified as the exact file match
    if (excludeDocIdFromExact && doc.id === excludeDocIdFromExact) {
      continue;
    }

    const rawDoc = doc as any;
    const docPath = rawDoc.storage_path || rawDoc.file_path || '';
    const nursingDoc: NursingDocument = {
      ...rawDoc,
      storage_path: docPath,
      file_path: docPath,
      public_url: docPath ? getDocumentPublicUrl(docPath) : '',
    };

    if (!doc.title) continue;

    const normDocTitle = normalizeText(doc.title);
    const docTitleTokens = tokenizeText(normDocTitle);

    const titleDice = diceCoefficient(normInputTitle, normDocTitle);
    const titleJaccard = tokenJaccardSimilarity(inputTitleTokens, docTitleTokens);
    const titleExact = normInputTitle === normDocTitle;

    const reasons: string[] = [];
    let titleScore = 0;

    if (titleExact) {
      titleScore = 1.0;
      reasons.push('Identical document title');
    } else if (titleDice >= 0.85 || titleJaccard >= 0.8) {
      titleScore = Math.max(titleDice, titleJaccard);
      reasons.push(`Title matches closely (${Math.round(titleScore * 100)}% text similarity)`);
    } else if (titleDice >= 0.65 || titleJaccard >= 0.6) {
      titleScore = (titleDice + titleJaccard) / 2;
      reasons.push(`Partial title match (${Math.round(titleScore * 100)}% keyword overlap)`);
    }

    if (titleScore < 0.6) {
      continue; // Not similar enough to warrant a metadata warning
    }

    // Authors check
    let authorScore = 0;
    if (authors.trim() && doc.authors) {
      authorScore = compareAuthors(authors, doc.authors);
      if (authorScore >= 0.7) {
        reasons.push('Researchers / authors match');
      }
    }

    // Academic Year
    let yearMatch = false;
    if (academicYear.trim() && doc.academic_year) {
      yearMatch = academicYear.trim() === doc.academic_year.trim();
      if (yearMatch) {
        reasons.push(`Same Academic Year (AY ${academicYear})`);
      }
    }

    // Program
    let programMatch = false;
    if (program.trim() && doc.program) {
      programMatch = normalizeText(program) === normalizeText(doc.program);
      if (programMatch) {
        reasons.push(`Same Academic Program (${program})`);
      }
    }

    // Document Type
    let typeMatch = false;
    if (documentType.trim() && doc.document_type) {
      typeMatch = documentType.trim() === doc.document_type.trim();
      if (typeMatch) {
        reasons.push(`Same Document Type (${documentType})`);
      }
    }

    // Weighted composite metadata score
    let compositeScore = titleScore * 65;
    if (authorScore > 0) compositeScore += authorScore * 15;
    if (yearMatch) compositeScore += 8;
    if (programMatch) compositeScore += 7;
    if (typeMatch) compositeScore += 5;

    const finalScore = Math.min(Math.round(compositeScore), 98); // Capped below 100 because 100 is reserved for exact file hash

    if (finalScore >= 65) {
      let severity: DuplicateSeverity = 'possible';
      if (finalScore >= 85) {
        severity = 'highly_likely';
      }

      matches.push({
        document: nursingDoc,
        similarityScore: finalScore,
        reasons,
        severity,
        isExactFile: false,
      });
    }
  }

  // Sort highest similarity first
  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  return matches;
}

export interface CheckDuplicatesParams {
  file?: File | Blob | null;
  fileHash?: string;
  title: string;
  authors?: string;
  academicYear?: string;
  documentType?: string;
  program?: string;
  excludeDocumentId?: string;
}

/**
 * Unified check function coordinating CHECK A (File Hash) and CHECK B (Metadata).
 */
export async function checkDocumentDuplicates(
  params: CheckDuplicatesParams
): Promise<DuplicateCheckResult> {
  const {
    file,
    fileHash: providedHash,
    title,
    authors = '',
    academicYear = '',
    documentType = '',
    program = '',
    excludeDocumentId,
  } = params;

  // 1. Calculate file hash if file provided and hash not yet computed
  let activeHash = providedHash;
  if (!activeHash && file) {
    try {
      activeHash = await calculateFileSha256(file);
    } catch (err) {
      console.warn('Could not compute file SHA-256 in checkDocumentDuplicates:', err);
    }
  }

  // 2. CHECK A: Exact File Hash Check (runs immediately without needing title)
  let exactMatch: DuplicateMatch | null = null;
  if (activeHash) {
    const fileResult = await checkExactFileDuplicate(activeHash, excludeDocumentId);
    if (fileResult.isDuplicate && fileResult.matchedDocument) {
      exactMatch = {
        document: fileResult.matchedDocument,
        similarityScore: 100,
        reasons: ['Exact SHA-256 cryptographic file signature match (identical PDF bytes)'],
        severity: 'exact',
        isExactFile: true,
      };
    }
  }

  // 3. CHECK B: Metadata Similarity Check (runs independently if title entered)
  let metadataMatches: DuplicateMatch[] = [];
  if (title && title.trim().length >= 4) {
    metadataMatches = await checkMetadataDuplicates({
      title,
      authors,
      academicYear,
      documentType,
      program,
      excludeDocumentId,
      excludeDocIdFromExact: exactMatch?.document.id,
    });
  }

  const allMatches: DuplicateMatch[] = [];
  if (exactMatch) {
    allMatches.push(exactMatch);
  }
  for (const m of metadataMatches) {
    allMatches.push(m);
  }

  const hasDuplicates = allMatches.length > 0;

  return {
    hasDuplicates,
    exactMatch,
    matches: allMatches,
    fileHash: activeHash,
  };
}

/**
 * Utility to backfill all legacy documents in the repository that have file_hash = NULL.
 * Can be triggered from the Admin Dashboard or run safely in the background.
 */
export async function backfillAllDocumentHashes(): Promise<{ updatedCount: number; errors: number }> {
  const supabase = getSupabase();
  if (!supabase) return { updatedCount: 0, errors: 0 };

  try {
    const { data: nullDocs, error } = await supabase
      .from('documents')
      .select('id, storage_path')
      .is('file_hash', null);

    if (error || !nullDocs || nullDocs.length === 0) {
      return { updatedCount: 0, errors: 0 };
    }

    let updatedCount = 0;
    let errors = 0;

    for (const doc of nullDocs) {
      if (!doc.storage_path) continue;
      try {
        const { data: blob, error: dlErr } = await supabase
          .storage
          .from('maltese-archive')
          .download(doc.storage_path);

        if (!dlErr && blob) {
          const hash = await calculateFileSha256(blob);
          const { error: upErr } = await supabase
            .from('documents')
            .update({ file_hash: hash })
            .eq('id', doc.id);

          if (!upErr) {
            updatedCount++;
          } else {
            errors++;
          }
        }
      } catch (err) {
        errors++;
      }
    }

    return { updatedCount, errors };
  } catch (err) {
    return { updatedCount: 0, errors: 1 };
  }
}
