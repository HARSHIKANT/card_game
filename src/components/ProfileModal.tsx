import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, ShieldCheck, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose?: () => void;
  forceOnboarding?: boolean;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, forceOnboarding }) => {
  const { upsertProfile, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: upsertError } = await upsertProfile(username);
    if (upsertError) {
      setError(upsertError.message || 'Error saving profile. Name might be taken.');
    } else if (onClose) {
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <User className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {forceOnboarding ? 'Set Your Name' : 'Edit Profile'}
            </h2>
            <p className="text-slate-400 text-center mt-2 text-sm sm:text-base">
              {forceOnboarding 
                ? 'Choose a unique username to represent you on the field.' 
                : 'Update your display name for the leaderboard.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-2 uppercase tracking-widest">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-base sm:text-lg"
                />
                <ShieldCheck className={`absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 ${username.length >= 3 ? 'text-green-500' : 'text-slate-600'}`} />
              </div>
              {error && (
                <div className="flex items-center gap-2 mt-2 sm:mt-3 text-red-400 text-xs sm:text-sm font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-900/20 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-sm sm:text-lg uppercase"
            >
              {loading ? 'Saving...' : forceOnboarding ? 'Start Playing' : 'Save Changes'}
            </button>
            
            {!forceOnboarding && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full text-slate-400 hover:text-white font-bold transition-colors py-2 text-sm sm:text-base"
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
