import React, { useRef, useEffect } from 'react';
import { Folder, Check, Plus, FolderMinus, Tag } from 'lucide-react';
import { BookmarkFolder } from '../types';
import { FOLDER_THEMES } from '../lib/folderThemes';

interface FolderAssignMenuProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  currentFolder?: BookmarkFolder;
  folders: BookmarkFolder[];
  onAssignToFolder: (documentId: string, folderId: string | null) => void;
  onCreateNewFolder: () => void;
  align?: 'left' | 'right';
}

export const FolderAssignMenu: React.FC<FolderAssignMenuProps> = ({
  isOpen,
  onClose,
  documentId,
  currentFolder,
  folders,
  onAssignToFolder,
  onCreateNewFolder,
  align = 'right',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`absolute z-40 mt-1 w-64 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-2 animate-scaleUp ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Tag className="w-3 h-3 text-amber-400" />
          <span>Move to Folder</span>
        </span>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-0.5 py-1 custom-scrollbar">
        {/* All Bookmarked Files / No Folder option */}
        <button
          onClick={() => {
            onAssignToFolder(documentId, null);
            onClose();
          }}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
            !currentFolder
              ? 'bg-amber-500/15 text-amber-300 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <FolderMinus className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">All Bookmarked Files</span>
          </div>
          {!currentFolder && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        </button>

        {/* Existing Custom Folders */}
        {folders.map(folder => {
          const theme = FOLDER_THEMES[folder.color] || FOLDER_THEMES.amber;
          const isSelected = currentFolder?.id === folder.id;

          return (
            <button
              key={folder.id}
              onClick={() => {
                onAssignToFolder(documentId, folder.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                isSelected
                  ? `${theme.bg} ${theme.text} font-semibold border ${theme.border}`
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Folder className={`w-4 h-4 ${theme.iconColor} shrink-0`} />
                <span className="truncate">{folder.name}</span>
              </div>
              {isSelected && <Check className={`w-3.5 h-3.5 ${theme.iconColor} shrink-0`} />}
            </button>
          );
        })}
      </div>

      {/* Footer action: Create new folder */}
      <div className="pt-1.5 mt-1 border-t border-white/10">
        <button
          onClick={() => {
            onClose();
            onCreateNewFolder();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-amber-300 hover:bg-amber-500/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Custom Folder...</span>
        </button>
      </div>
    </div>
  );
};
