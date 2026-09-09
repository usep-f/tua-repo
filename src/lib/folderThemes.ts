import { FolderColor } from '../types';

export interface FolderThemeConfig {
  id: FolderColor;
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  badge: string;
  badgeActive: string;
  iconColor: string;
  hoverBorder: string;
  hoverBg: string;
}

export const FOLDER_THEMES: Record<FolderColor, FolderThemeConfig> = {
  amber: {
    id: 'amber',
    label: 'Amber Gold',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    badgeActive: 'bg-amber-500/25 text-amber-200 border-amber-400 shadow-sm shadow-amber-500/20',
    iconColor: 'text-amber-400',
    hoverBorder: 'hover:border-amber-400/50',
    hoverBg: 'hover:bg-amber-500/15',
  },
  blue: {
    id: 'blue',
    label: 'Scholarly Blue',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    dot: 'bg-blue-400',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    badgeActive: 'bg-blue-500/25 text-blue-200 border-blue-400 shadow-sm shadow-blue-500/20',
    iconColor: 'text-blue-400',
    hoverBorder: 'hover:border-blue-400/50',
    hoverBg: 'hover:bg-blue-500/15',
  },
  emerald: {
    id: 'emerald',
    label: 'Clinical Emerald',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    badgeActive: 'bg-emerald-500/25 text-emerald-200 border-emerald-400 shadow-sm shadow-emerald-500/20',
    iconColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-400/50',
    hoverBg: 'hover:bg-emerald-500/15',
  },
  purple: {
    id: 'purple',
    label: 'Royal Purple',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    dot: 'bg-purple-400',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    badgeActive: 'bg-purple-500/25 text-purple-200 border-purple-400 shadow-sm shadow-purple-500/20',
    iconColor: 'text-purple-400',
    hoverBorder: 'hover:border-purple-400/50',
    hoverBg: 'hover:bg-purple-500/15',
  },
  rose: {
    id: 'rose',
    label: 'Crimson Rose',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-300',
    dot: 'bg-rose-400',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    badgeActive: 'bg-rose-500/25 text-rose-200 border-rose-400 shadow-sm shadow-rose-500/20',
    iconColor: 'text-rose-400',
    hoverBorder: 'hover:border-rose-400/50',
    hoverBg: 'hover:bg-rose-500/15',
  },
  cyan: {
    id: 'cyan',
    label: 'Ocean Cyan',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-300',
    dot: 'bg-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    badgeActive: 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow-sm shadow-cyan-500/20',
    iconColor: 'text-cyan-400',
    hoverBorder: 'hover:border-cyan-400/50',
    hoverBg: 'hover:bg-cyan-500/15',
  },
  indigo: {
    id: 'indigo',
    label: 'Deep Indigo',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-300',
    dot: 'bg-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    badgeActive: 'bg-indigo-500/25 text-indigo-200 border-indigo-400 shadow-sm shadow-indigo-500/20',
    iconColor: 'text-indigo-400',
    hoverBorder: 'hover:border-indigo-400/50',
    hoverBg: 'hover:bg-indigo-500/15',
  },
  slate: {
    id: 'slate',
    label: 'Classic Slate',
    bg: 'bg-slate-700/20',
    border: 'border-slate-500/30',
    text: 'text-slate-300',
    dot: 'bg-slate-400',
    badge: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    badgeActive: 'bg-slate-600/50 text-slate-100 border-slate-400 shadow-sm shadow-slate-900/40',
    iconColor: 'text-slate-400',
    hoverBorder: 'hover:border-slate-400/50',
    hoverBg: 'hover:bg-slate-700/30',
  },
};

export const DEFAULT_FOLDER_COLOR: FolderColor = 'amber';

export const FOLDER_COLOR_LIST: FolderColor[] = [
  'amber',
  'blue',
  'emerald',
  'purple',
  'rose',
  'cyan',
  'indigo',
  'slate',
];
