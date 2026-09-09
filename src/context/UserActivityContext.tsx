import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { NursingDocument, RecentlyViewedItem, BookmarkFolder, FolderColor } from '../types';
import { useAuth } from './AuthContext';
import { getSupabase } from '../lib/supabase';

interface UserActivityContextType {
  // Bookmarks
  bookmarkedIds: string[];
  bookmarkedDocuments: NursingDocument[];
  isBookmarked: (documentId: string) => boolean;
  toggleBookmark: (documentOrId: NursingDocument | string) => void;
  removeBookmark: (documentId: string) => void;
  clearAllBookmarks: () => void;
  isLoadingBookmarks: boolean;
  reconcileBookmarks: () => Promise<void>;

  // Custom Folders
  folders: BookmarkFolder[];
  docFolderMap: Record<string, string>; // documentId -> folderId
  createFolder: (name: string, color?: FolderColor) => BookmarkFolder;
  updateFolder: (folderId: string, updates: { name?: string; color?: FolderColor }) => void;
  deleteFolder: (folderId: string) => void;
  assignDocToFolder: (documentId: string, folderId: string | null) => void;
  assignMultipleDocsToFolder: (documentIds: string[], folderId: string | null) => void;
  getDocFolder: (documentId: string) => BookmarkFolder | undefined;
  getFolderDocCount: (folderId: string) => number;
  getUnfiledDocCount: () => number;

  // Recently Viewed
  recentlyViewed: RecentlyViewedItem[];
  trackView: (document: NursingDocument) => void;
  removeRecentView: (documentId: string) => void;
  clearRecentlyViewed: () => void;
  reconcileRecentlyViewed: () => Promise<void>;
}

const UserActivityContext = createContext<UserActivityContextType | undefined>(undefined);

const MAX_RECENTLY_VIEWED = 20;

export const UserActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Unique storage key based on user ID or fallback to anonymous/guest
  const userId = user?.id || user?.email || 'guest';
  const BOOKMARKS_KEY = `maltese_bookmarks_${userId}`;
  const BOOKMARKED_DOCS_KEY = `maltese_bookmarked_docs_${userId}`;
  const RECENT_KEY = `maltese_recently_viewed_${userId}`;
  const FOLDERS_KEY = `maltese_bookmark_folders_${userId}`;
  const DOC_FOLDER_MAP_KEY = `maltese_doc_folder_map_${userId}`;

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(BOOKMARKS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [bookmarkedDocsMap, setBookmarkedDocsMap] = useState<Record<string, NursingDocument>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(BOOKMARKED_DOCS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [folders, setFolders] = useState<BookmarkFolder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(FOLDERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [docFolderMap, setDocFolderMap] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(DOC_FOLDER_MAP_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

  // Persist bookmarks whenever changed
  const saveBookmarksToStorage = useCallback(
    (newIds: string[], newDocsMap: Record<string, NursingDocument>) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newIds));
        localStorage.setItem(BOOKMARKED_DOCS_KEY, JSON.stringify(newDocsMap));
      } catch (e) {
        console.warn('Failed to save bookmarks to localStorage:', e);
      }
    },
    [BOOKMARKS_KEY, BOOKMARKED_DOCS_KEY]
  );

  // Persist folders whenever changed
  const saveFoldersToStorage = useCallback(
    (newFolders: BookmarkFolder[]) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(newFolders));
      } catch (e) {
        console.warn('Failed to save folders to localStorage:', e);
      }
    },
    [FOLDERS_KEY]
  );

  // Persist docFolderMap whenever changed
  const saveDocFolderMapToStorage = useCallback(
    (newMap: Record<string, string>) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(DOC_FOLDER_MAP_KEY, JSON.stringify(newMap));
      } catch (e) {
        console.warn('Failed to save doc folder map to localStorage:', e);
      }
    },
    [DOC_FOLDER_MAP_KEY]
  );

  // Persist recently viewed whenever changed
  const saveRecentToStorage = useCallback(
    (items: RecentlyViewedItem[]) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(items));
      } catch (e) {
        console.warn('Failed to save recently viewed to localStorage:', e);
      }
    },
    [RECENT_KEY]
  );

  // Helper to persist folder data and assignments directly to Supabase
  const syncToSupabase = useCallback(
    async (
      currentFolders: BookmarkFolder[],
      currentMap: Record<string, string>,
      currentBookmarkIds: string[],
      actionDocId?: string,
      action?: 'add' | 'remove'
    ) => {
      const supabase = getSupabase();
      if (!supabase || !user?.id) return;

      try {
        // 1. Primary Supabase Cloud persistence: Update user metadata on Supabase Auth
        // This persists across refresh, across devices, and across logout/login sessions
        await supabase.auth.updateUser({
          data: {
            bookmark_folders: currentFolders,
            doc_folder_map: currentMap,
            bookmarked_ids: currentBookmarkIds,
          },
        });
      } catch (err) {
        console.warn('Could not sync user activity to Supabase user_metadata:', err);
      }

      // 2. Also attempt to sync to relational tables if present in Supabase
      try {
        if (actionDocId && action === 'remove') {
          await supabase.from('user_bookmarks').delete().eq('user_id', user.id).eq('document_id', actionDocId);
          await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('document_id', actionDocId);
          await supabase.from('user_folder_assignments').delete().eq('user_id', user.id).eq('document_id', actionDocId);
        } else if (actionDocId && action === 'add') {
          await supabase.from('user_bookmarks').upsert({ user_id: user.id, document_id: actionDocId }, { onConflict: 'user_id,document_id' });
          await supabase.from('bookmarks').upsert({ user_id: user.id, document_id: actionDocId }, { onConflict: 'user_id,document_id' });
        }

        if (currentFolders.length > 0) {
          for (const folder of currentFolders) {
            await supabase.from('bookmark_folders').upsert(
              {
                id: folder.id,
                user_id: user.id,
                name: folder.name,
                color: folder.color,
                created_at: folder.createdAt,
              },
              { onConflict: 'id' }
            );
          }
        }
      } catch {
        // Silently skip if table does not exist
      }
    },
    [user?.id]
  );

  // Helper to fetch folder data and assignments from Supabase
  const fetchFromSupabase = useCallback(
    async (activeUser: any) => {
      const supabase = getSupabase();
      if (!supabase || !activeUser?.id) return;

      try {
        // 1. Check Supabase user_metadata
        const { data: userData } = await supabase.auth.getUser();
        const meta = userData?.user?.user_metadata || activeUser?.user_metadata;
        if (meta) {
          let hasMetaUpdates = false;
          if (Array.isArray(meta.bookmark_folders) && meta.bookmark_folders.length > 0) {
            setFolders(meta.bookmark_folders);
            saveFoldersToStorage(meta.bookmark_folders);
            hasMetaUpdates = true;
          }
          if (meta.doc_folder_map && typeof meta.doc_folder_map === 'object') {
            setDocFolderMap(meta.doc_folder_map);
            saveDocFolderMapToStorage(meta.doc_folder_map);
            hasMetaUpdates = true;
          }
          if (Array.isArray(meta.bookmarked_ids)) {
            setBookmarkedIds(meta.bookmarked_ids);
            hasMetaUpdates = true;
          }
          if (hasMetaUpdates) {
            console.log('Successfully hydrated folders and assignments from Supabase Cloud');
          }
        }

        // 2. Query relational tables if available in Supabase
        try {
          const { data: tableFolders } = await supabase
            .from('bookmark_folders')
            .select('*')
            .eq('user_id', activeUser.id);

          if (tableFolders && tableFolders.length > 0) {
            const mappedFolders: BookmarkFolder[] = tableFolders.map((row: any) => ({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            }));
            setFolders(mappedFolders);
            saveFoldersToStorage(mappedFolders);
          }

          const { data: tableAssignments } = await supabase
            .from('user_folder_assignments')
            .select('document_id, folder_id')
            .eq('user_id', activeUser.id);

          if (tableAssignments && tableAssignments.length > 0) {
            const mappedAssignments: Record<string, string> = {};
            tableAssignments.forEach((row: any) => {
              if (row.folder_id) {
                mappedAssignments[row.document_id] = row.folder_id;
              }
            });
            setDocFolderMap(mappedAssignments);
            saveDocFolderMapToStorage(mappedAssignments);
          }
        } catch {
          // Table queries skip gracefully if not created
        }
      } catch (err) {
        console.warn('Notice loading user activity from Supabase:', err);
      }
    },
    [saveFoldersToStorage, saveDocFolderMapToStorage]
  );

  const lastFetchedUserIdRef = useRef<string | null>(null);

  // When active user changes, reload from storage and Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedIds = localStorage.getItem(BOOKMARKS_KEY);
      const parsedIds: string[] = savedIds ? JSON.parse(savedIds) : [];
      setBookmarkedIds(parsedIds);

      const savedDocs = localStorage.getItem(BOOKMARKED_DOCS_KEY);
      const parsedDocs: Record<string, NursingDocument> = savedDocs ? JSON.parse(savedDocs) : {};
      setBookmarkedDocsMap(parsedDocs);

      const savedFolders = localStorage.getItem(FOLDERS_KEY);
      const parsedFolders: BookmarkFolder[] = savedFolders ? JSON.parse(savedFolders) : [];
      setFolders(parsedFolders);

      const savedDocFolderMap = localStorage.getItem(DOC_FOLDER_MAP_KEY);
      const parsedDocFolderMap: Record<string, string> = savedDocFolderMap ? JSON.parse(savedDocFolderMap) : {};
      setDocFolderMap(parsedDocFolderMap);

      const savedRecent = localStorage.getItem(RECENT_KEY);
      const parsedRecent: RecentlyViewedItem[] = savedRecent ? JSON.parse(savedRecent) : [];
      setRecentlyViewed(parsedRecent);
    } catch (e) {
      console.warn('Error loading user activity data from localStorage:', e);
    }

    // Hydrate from Supabase only when user ID actually changes (avoids re-fetch on auth token refresh / updateUser)
    if (user?.id) {
      if (lastFetchedUserIdRef.current !== user.id) {
        lastFetchedUserIdRef.current = user.id;
        fetchFromSupabase(user);
      }
    } else {
      lastFetchedUserIdRef.current = null;
    }
  }, [user?.id, BOOKMARKS_KEY, BOOKMARKED_DOCS_KEY, FOLDERS_KEY, DOC_FOLDER_MAP_KEY, RECENT_KEY, fetchFromSupabase]);

  // Check if a document is currently bookmarked
  const isBookmarked = useCallback(
    (documentId: string): boolean => {
      if (!documentId) return false;
      return bookmarkedIds.includes(documentId);
    },
    [bookmarkedIds]
  );

  // Toggle bookmark status (supports either NursingDocument or documentId string)
  const toggleBookmark = useCallback(
    (documentOrId: NursingDocument | string) => {
      if (!documentOrId) return;
      const docId = typeof documentOrId === 'string' ? documentOrId : documentOrId.id;
      if (!docId) return;

      const docObj: NursingDocument | undefined =
        typeof documentOrId === 'object'
          ? documentOrId
          : bookmarkedDocsMap[docId];

      setBookmarkedIds(prevIds => {
        const exists = prevIds.includes(docId);
        const updatedIds = exists
          ? prevIds.filter(id => id !== docId)
          : [docId, ...prevIds.filter(id => id !== docId)];

        setBookmarkedDocsMap(prevDocs => {
          const nextDocs = { ...prevDocs };
          if (exists) {
            delete nextDocs[docId];
          } else if (docObj) {
            nextDocs[docId] = docObj;
          }
          saveBookmarksToStorage(updatedIds, nextDocs);
          return nextDocs;
        });

        // Also remove folder assignment for this document if unbookmarking
        setDocFolderMap(prevMap => {
          const nextMap = { ...prevMap };
          if (exists && nextMap[docId]) {
            delete nextMap[docId];
            saveDocFolderMapToStorage(nextMap);
          }
          // Defer supabase sync to avoid executing inside state updater
          setTimeout(() => {
            syncToSupabase(folders, nextMap, updatedIds, docId, exists ? 'remove' : 'add');
          }, 0);
          return nextMap;
        });

        return updatedIds;
      });
    },
    [bookmarkedDocsMap, folders, saveBookmarksToStorage, saveDocFolderMapToStorage, syncToSupabase]
  );

  // Explicit remove bookmark
  const removeBookmark = useCallback(
    (documentId: string) => {
      if (!documentId) return;
      toggleBookmark(documentId);
    },
    [toggleBookmark]
  );

  // Clear all bookmarks (keeps custom folder definitions intact)
  const clearAllBookmarks = useCallback(() => {
    setBookmarkedIds([]);
    setBookmarkedDocsMap({});
    setDocFolderMap({});
    saveBookmarksToStorage([], {});
    saveDocFolderMapToStorage({});
  }, [saveBookmarksToStorage, saveDocFolderMapToStorage]);

  // Create a new folder
  const createFolder = useCallback(
    (name: string, color: FolderColor = 'amber'): BookmarkFolder => {
      const trimmed = name.trim() || 'Untitled Folder';
      const newFolder: BookmarkFolder = {
        id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmed,
        color,
        createdAt: new Date().toISOString(),
      };

      setFolders(prev => {
        const updated = [...prev, newFolder];
        saveFoldersToStorage(updated);
        syncToSupabase(updated, docFolderMap, bookmarkedIds);
        return updated;
      });

      return newFolder;
    },
    [saveFoldersToStorage, syncToSupabase, docFolderMap, bookmarkedIds]
  );

  // Update folder (rename or color)
  // Renaming does not affect or remove any bookmarked files inside it
  const updateFolder = useCallback(
    (folderId: string, updates: { name?: string; color?: FolderColor }) => {
      if (!folderId) return;

      setFolders(prev => {
        const updated = prev.map(f => {
          if (f.id === folderId) {
            return {
              ...f,
              name: updates.name !== undefined ? (updates.name.trim() || f.name) : f.name,
              color: updates.color !== undefined ? updates.color : f.color,
            };
          }
          return f;
        });
        saveFoldersToStorage(updated);
        syncToSupabase(updated, docFolderMap, bookmarkedIds);
        return updated;
      });
    },
    [saveFoldersToStorage, syncToSupabase, docFolderMap, bookmarkedIds]
  );

  // Delete folder
  // "When deleting a folder, do not delete the bookmarked files inside it. Instead, move those files back to the general All Bookmarked Files view."
  const deleteFolder = useCallback(
    (folderId: string) => {
      if (!folderId) return;

      let nextFolders: BookmarkFolder[] = [];
      setFolders(prev => {
        nextFolders = prev.filter(f => f.id !== folderId);
        saveFoldersToStorage(nextFolders);
        return nextFolders;
      });

      // Remove assignments pointing to this folder, leaving bookmarks completely intact
      setDocFolderMap(prevMap => {
        const updatedMap = { ...prevMap };
        let changed = false;
        for (const [docId, fId] of Object.entries(updatedMap)) {
          if (fId === folderId) {
            delete updatedMap[docId];
            changed = true;
          }
        }
        if (changed) {
          saveDocFolderMapToStorage(updatedMap);
          syncToSupabase(nextFolders, updatedMap, bookmarkedIds);
        }
        return updatedMap;
      });
    },
    [saveFoldersToStorage, saveDocFolderMapToStorage, syncToSupabase, bookmarkedIds]
  );

  // Assign document to folder (pass folderId = null to move back to general/unfiled All Bookmarked Files)
  const assignDocToFolder = useCallback(
    (documentId: string, folderId: string | null) => {
      if (!documentId) return;

      setDocFolderMap(prevMap => {
        const updatedMap = { ...prevMap };
        if (folderId) {
          updatedMap[documentId] = folderId;
        } else {
          delete updatedMap[documentId];
        }
        saveDocFolderMapToStorage(updatedMap);

        // Immediate persistent sync to Supabase Cloud
        syncToSupabase(folders, updatedMap, bookmarkedIds);

        // Also query relational table user_folder_assignments if created in Supabase
        const supabase = getSupabase();
        if (supabase && user?.id) {
          (async () => {
            try {
              if (folderId) {
                await supabase
                  .from('user_folder_assignments')
                  .upsert(
                    {
                      user_id: user.id,
                      document_id: documentId,
                      folder_id: folderId,
                    },
                    { onConflict: 'user_id,document_id' }
                  );
              } else {
                await supabase
                  .from('user_folder_assignments')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('document_id', documentId);
              }
            } catch {
              // Silently ignore if table does not exist
            }
          })();
        }

        return updatedMap;
      });
    },
    [folders, bookmarkedIds, user?.id, saveDocFolderMapToStorage, syncToSupabase]
  );

  // Assign multiple documents to a folder in a single batch operation
  const assignMultipleDocsToFolder = useCallback(
    (documentIds: string[], folderId: string | null) => {
      if (!documentIds || documentIds.length === 0) return;

      setDocFolderMap(prevMap => {
        const updatedMap = { ...prevMap };
        documentIds.forEach(id => {
          if (folderId) {
            updatedMap[id] = folderId;
          } else {
            delete updatedMap[id];
          }
        });

        saveDocFolderMapToStorage(updatedMap);

        // Immediate persistent sync to Supabase Cloud
        syncToSupabase(folders, updatedMap, bookmarkedIds);

        // Also query relational table user_folder_assignments if created in Supabase
        const supabase = getSupabase();
        if (supabase && user?.id) {
          (async () => {
            try {
              if (folderId) {
                const upsertRows = documentIds.map(docId => ({
                  user_id: user.id,
                  document_id: docId,
                  folder_id: folderId,
                }));
                await supabase
                  .from('user_folder_assignments')
                  .upsert(upsertRows, { onConflict: 'user_id,document_id' });
              } else {
                await supabase
                  .from('user_folder_assignments')
                  .delete()
                  .eq('user_id', user.id)
                  .in('document_id', documentIds);
              }
            } catch {
              // Silently ignore if table does not exist
            }
          })();
        }

        return updatedMap;
      });
    },
    [folders, bookmarkedIds, user?.id, saveDocFolderMapToStorage, syncToSupabase]
  );

  // Get folder for a document
  const getDocFolder = useCallback(
    (documentId: string): BookmarkFolder | undefined => {
      const fId = docFolderMap[documentId];
      if (!fId) return undefined;
      return folders.find(f => f.id === fId);
    },
    [docFolderMap, folders]
  );

  // Count documents in a folder
  const getFolderDocCount = useCallback(
    (folderId: string): number => {
      return bookmarkedIds.filter(id => docFolderMap[id] === folderId).length;
    },
    [bookmarkedIds, docFolderMap]
  );

  // Count unfiled documents (bookmarked, but not in any active folder)
  const getUnfiledDocCount = useCallback((): number => {
    return bookmarkedIds.filter(
      id => !docFolderMap[id] || !folders.some(f => f.id === docFolderMap[id])
    ).length;
  }, [bookmarkedIds, docFolderMap, folders]);

  // Track viewing a document:
  // Avoid duplicate entries for the same file; viewing a file again should update its position to top
  const trackView = useCallback(
    (document: NursingDocument) => {
      if (!document || !document.id) return;

      setRecentlyViewed(prevList => {
        const now = new Date().toISOString();
        // Remove existing occurrence if present
        const filtered = prevList.filter(item => item.documentId !== document.id);

        const newItem: RecentlyViewedItem = {
          documentId: document.id,
          viewedAt: now,
          document: { ...document },
        };

        const updated = [newItem, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
        saveRecentToStorage(updated);
        return updated;
      });
    },
    [saveRecentToStorage]
  );

  // Remove a single item from recently viewed
  const removeRecentView = useCallback(
    (documentId: string) => {
      setRecentlyViewed(prevList => {
        const updated = prevList.filter(item => item.documentId !== documentId);
        saveRecentToStorage(updated);
        return updated;
      });
    },
    [saveRecentToStorage]
  );

  // Clear all recently viewed
  const clearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
    saveRecentToStorage([]);
  }, [saveRecentToStorage]);

  const isReconcilingRef = useRef(false);

  // Reconcile bookmarks with database to gracefully remove deleted or unavailable files
  const reconcileBookmarks = useCallback(async () => {
    if (isReconcilingRef.current) return;

    setBookmarkedIds(currentIds => {
      if (currentIds.length === 0) return currentIds;

      isReconcilingRef.current = true;
      setIsLoadingBookmarks(true);

      const supabase = getSupabase();
      if (!supabase) {
        isReconcilingRef.current = false;
        setIsLoadingBookmarks(false);
        return currentIds;
      }

      (async () => {
        try {
          const { data, error } = await supabase
            .from('documents')
            .select('*')
            .in('id', currentIds);

          if (error) {
            console.warn('Could not verify bookmarks in database:', error);
            return;
          }

          if (data) {
            const validDocsMap: Record<string, NursingDocument> = {};
            data.forEach(doc => {
              validDocsMap[doc.id] = doc as NursingDocument;
            });

            // Re-check with current state: only keep IDs that STILL exist in current state AND exist in database
            setBookmarkedIds(latestIds => {
              const validIds = latestIds.filter(id => Boolean(validDocsMap[id]));
              setBookmarkedDocsMap(prevDocs => {
                const nextDocs: Record<string, NursingDocument> = {};
                validIds.forEach(id => {
                  if (validDocsMap[id]) {
                    nextDocs[id] = validDocsMap[id];
                  } else if (prevDocs[id]) {
                    nextDocs[id] = prevDocs[id];
                  }
                });
                saveBookmarksToStorage(validIds, nextDocs);
                return nextDocs;
              });

              // Prune orphaned folder assignments
              setDocFolderMap(prevMap => {
                const updatedMap = { ...prevMap };
                const validSet = new Set(validIds);
                let changed = false;
                for (const docId of Object.keys(updatedMap)) {
                  if (!validSet.has(docId)) {
                    delete updatedMap[docId];
                    changed = true;
                  }
                }
                if (changed) {
                  saveDocFolderMapToStorage(updatedMap);
                }
                return updatedMap;
              });

              return validIds;
            });
          }
        } catch (err) {
          console.warn('Failed to reconcile bookmarks:', err);
        } finally {
          isReconcilingRef.current = false;
          setIsLoadingBookmarks(false);
        }
      })();

      return currentIds;
    });
  }, [saveBookmarksToStorage, saveDocFolderMapToStorage]);

  // Reconcile recently viewed with database to gracefully remove deleted or unavailable files
  const reconcileRecentlyViewed = useCallback(async () => {
    if (recentlyViewed.length === 0) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const ids = recentlyViewed.map(item => item.documentId);
      const { data, error } = await supabase
        .from('documents')
        .select('id')
        .in('id', ids);

      if (error) {
        console.warn('Could not verify recently viewed in database:', error);
        return;
      }

      if (data) {
        const validIdSet = new Set(data.map(d => d.id));
        const pruned = recentlyViewed.filter(item => validIdSet.has(item.documentId));
        if (pruned.length !== recentlyViewed.length) {
          setRecentlyViewed(pruned);
          saveRecentToStorage(pruned);
        }
      }
    } catch (err) {
      console.warn('Failed to reconcile recently viewed:', err);
    }
  }, [recentlyViewed, saveRecentToStorage]);

  // Initial reconciliation on mount if IDs exist
  useEffect(() => {
    if (bookmarkedIds.length > 0) {
      reconcileBookmarks();
    }
    if (recentlyViewed.length > 0) {
      reconcileRecentlyViewed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute array of bookmarked documents in order of bookmarkedIds
  const bookmarkedDocuments: NursingDocument[] = bookmarkedIds
    .map(id => bookmarkedDocsMap[id])
    .filter(Boolean);

  return (
    <UserActivityContext.Provider
      value={{
        bookmarkedIds,
        bookmarkedDocuments,
        isBookmarked,
        toggleBookmark,
        removeBookmark,
        clearAllBookmarks,
        isLoadingBookmarks,
        reconcileBookmarks,
        folders,
        docFolderMap,
        createFolder,
        updateFolder,
        deleteFolder,
        assignDocToFolder,
        assignMultipleDocsToFolder,
        getDocFolder,
        getFolderDocCount,
        getUnfiledDocCount,
        recentlyViewed,
        trackView,
        removeRecentView,
        clearRecentlyViewed,
        reconcileRecentlyViewed,
      }}
    >
      {children}
    </UserActivityContext.Provider>
  );
};

export const useUserActivity = (): UserActivityContextType => {
  const context = useContext(UserActivityContext);
  if (!context) {
    throw new Error('useUserActivity must be used within a UserActivityProvider');
  }
  return context;
};
