import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface ProfilePageProps {
  onBackToHome: () => void;
  onBrowseRepository: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onBackToHome,
  onBrowseRepository,
}) => {
  const { user, isAdmin } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [program, setProgram] = useState<string>('');
  const [yearLevel, setYearLevel] = useState<string>('');

  // Load user profile from public.profiles
  useEffect(() => {
    async function loadProfile() {
      if (!user || !user.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const supabase = getSupabase();
      if (!supabase) {
        setErrorMessage('Database connection is unavailable.');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.warn('Error loading profile:', error);
          setErrorMessage('Could not load profile information: ' + error.message);
        } else if (data) {
          setProfile(data);
          setFullName(data.full_name || '');
          setContactNumber(data.contact_number || '');
          setProgram(data.program || '');
          setYearLevel(data.year_level || '');
        } else {
          setFullName('');
          setContactNumber('');
          setProgram('');
          setYearLevel('');
        }
      } catch (err: any) {
        console.error('Exception loading profile:', err);
        setErrorMessage(err.message || 'Unexpected error loading profile.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  // Handle save changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) return;

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const supabase = getSupabase();
    if (!supabase) {
      setErrorMessage('Database connection is unavailable.');
      setIsSaving(false);
      return;
    }

    try {
      const payload = {
        user_id: user.id,
        full_name: fullName.trim() || null,
        contact_number: contactNumber.trim() || null,
        program: program.trim() || null,
        year_level: yearLevel.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Update existing row in public.profiles
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: payload.full_name,
          contact_number: payload.contact_number,
          program: payload.program,
          year_level: payload.year_level,
          updated_at: payload.updated_at,
        })
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        const { data: upsertData, error: upsertError } = await supabase
          .from('profiles')
          .upsert(payload, { onConflict: 'user_id' })
          .select()
          .maybeSingle();

        if (upsertError) {
          throw new Error(upsertError.message);
        }
        if (upsertData) {
          setProfile(upsertData);
        }
      } else if (data) {
        setProfile(data);
      }

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Save profile error:', err);
      setErrorMessage(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'MA';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn w-full min-w-0">
      {/* Back navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={onBrowseRepository}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Repository</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-24 -bottom-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-amber-500 p-1 shadow-xl shadow-blue-950/50 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                {profile?.profile_image_path ? (
                  <img
                    src={profile.profile_image_path}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-2xl sm:text-3xl font-serif font-black text-amber-300 tracking-wider">
                    {getInitials()}
                  </span>
                )}
              </div>
            </div>

            {isAdmin && (
              <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow-md flex items-center gap-1 border border-amber-300">
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </span>
            )}
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>User Profile</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight truncate">
              {fullName || user?.email || 'Scholar'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5 font-mono">
              <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </p>

            {program && (
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{program} {yearLevel ? `• ${yearLevel}` : ''}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs sm:text-sm flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="border-b border-white/10 pb-5 mb-6">
          <h2 className="text-lg font-bold text-white font-serif">Profile Information</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Update your personal and academic details stored securely in your profile record.
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading your profile data...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Institutional Email (Supabase Auth)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/50 border border-white/5 text-slate-400 text-xs sm:text-sm cursor-not-allowed font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Email is managed by Supabase authentication.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Contact Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={e => setContactNumber(e.target.value)}
                    placeholder="e.g. +63 912 345 6789"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Nursing Program
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={program}
                    onChange={e => setProgram(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select Program...</option>
                    <option value="BS Nursing">BS Nursing</option>
                    <option value="MS Nursing">MS Nursing</option>
                    <option value="DNP">Doctor of Nursing Practice (DNP)</option>
                    <option value="PhD Nursing">PhD in Nursing</option>
                    <option value="Post-Master's Certificate">Post-Master's Certificate</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Year Level / Status
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={yearLevel}
                    onChange={e => setYearLevel(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select Year Level / Status...</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Graduate Student">Graduate Student</option>
                    <option value="Faculty / Researcher">Faculty / Researcher</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
