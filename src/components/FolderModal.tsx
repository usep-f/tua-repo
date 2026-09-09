import React, { useState, useEffect } from 'react';
import { Folder, X, Check, Sparkles } from 'lucide-react';
import { BookmarkFolder, FolderColor } from '../types';
import { FOLDER_THEMES, FOLDER_COLOR_LIST, DEFAULT_FOLDER_COLOR } from '../lib/folderThemes';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: FolderColor) => void;
  folderToEdit?: BookmarkFolder | null;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  folderToEdit,
}) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<FolderColor>(DEFAULT_FOLDER_COLOR);
  const [error, setError] = useState('');

  const isEditing = Boolean(folderToEdit);

  useEffect(() => {
    if (isOpen) {
      if (folderToEdit) {
        setName(folderToEdit.name);
        setSelectedColor(folderToEdit.color);
      } else {
        setName('');
        setSelectedColor(DEFAULT_FOLDER_COLOR);
      }
      setError('');
    }
  }, [isOpen, folderToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a folder name');
      return;
    }
    if (trimmed.length > 50) {
      setError('Folder name must be 50 characters or fewer');
      return;
    }
    onSave(trimmed, selectedColor);
    onClose();
  };

  const currentTheme = FOLDER_THEMES[selectedColor];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Background glow accent */}
        <div
          className={`absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl opacity-30 pointer-events-none ${currentTheme.dot}`}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${currentTheme.bg} border ${currentTheme.border}`}>
              <Folder className={`w-5 h-5 ${currentTheme.iconColor}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-serif">
                {isEditing ? 'Edit Folder' : 'Create Custom Folder'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? 'Update folder name or customize its color theme'
                  : 'Group your bookmarked files for easy organization'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Folder Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Folder Name <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Pediatric Nursing, DNP Scholarly Projects"
                maxLength={50}
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 font-mono">
                {name.length}/50
              </span>
            </div>
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Folder Color Theme
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Choose an accessible accent aligned with the repository's visual palette:
            </p>

            <div className="grid grid-cols-4 gap-2.5">
              {FOLDER_COLOR_LIST.map(color => {
                const theme = FOLDER_THEMES[color];
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`group relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? `${theme.bg} ${theme.border} ring-2 ring-white/20 shadow-lg`
                        : 'bg-slate-950/40 border-white/5 hover:border-white/20 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      <div className={`w-6 h-6 rounded-full ${theme.dot} shadow-sm flex items-center justify-center`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-300 truncate max-w-full">
                      {theme.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`p-1.5 rounded-lg ${currentTheme.bg} border ${currentTheme.border}`}>
                <Folder className={`w-4 h-4 ${currentTheme.iconColor}`} />
              </span>
              <div className="truncate">
                <span className="text-xs font-semibold text-white block truncate">
                  {name.trim() || 'Untitled Folder'}
                </span>
                <span className="text-[11px] text-slate-400">Preview tag</span>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${currentTheme.badge}`}
            >
              {currentTheme.label}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              {isEditing ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
