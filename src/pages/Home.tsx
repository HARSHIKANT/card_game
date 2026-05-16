import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy, Users, LogIn, UserCircle, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ProfileModal from '../components/ProfileModal';
import Card from '../components/Card';
import { PlayerCard } from '../types';

const playHapticSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // Ignore if audio context fails
  }
};

function Home() {
  const navigate = useNavigate();
  const { user, profile, loadingProfile } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [landingCards, setLandingCards] = useState<PlayerCard[]>([]);

  useEffect(() => {
    const fetchLandingCards = async () => {
      const { data, error } = await supabase.from('players').select('*').limit(6);
      if (data && data.length > 0 && !error) {
        setLandingCards(data as PlayerCard[]);
      }
    };
    fetchLandingCards();
  }, []);

  const handleAuth = async (type: 'login' | 'signup') => {
    setLoading(true);
    setError(null);
    let result;
    if (type === 'signup') {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    if (result.error) {
      setError(result.error.message);
    } else if (type === 'login') {
      navigate('/lobby');
    } else {
      setError("Check your email for the confirmation link!");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-full min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Onboarding Overlay */}
      {user && !loadingProfile && !profile && (
        <ProfileModal isOpen={true} forceOnboarding={true} />
      )}

      {/* Profile Edit Modal */}
      <ProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
      />

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] sm:w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] sm:w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-sm sm:max-w-lg">
        {/* Fanned Cards Display */}
        <div className="relative w-[300px] sm:w-[400px] h-[160px] sm:h-[200px] md:h-[220px] flex justify-center items-end mb-4 pointer-events-auto z-20 mt-4">
          {landingCards.map((card, i) => {
            const angle = (i - 2.5) * 12; 
            const translateY = Math.abs(i - 2.5) * 12; 
            const translateX = (i - 2.5) * 35; 

            return (
              <div 
                key={card.id}
                onMouseEnter={playHapticSound}
                onTouchStart={playHapticSound}
                className="absolute bottom-0 origin-bottom transition-all duration-300 hover:z-30 cursor-pointer"
                style={{ 
                  transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${angle}deg)`,
                  zIndex: 10 + i
                }}
              >
                <div className="transform scale-[0.55] sm:scale-[0.65] md:scale-[0.75] hover:-translate-y-6 hover:scale-[0.6] sm:hover:scale-[0.7] md:hover:scale-[0.8] transition-transform duration-300 drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)]">
                  <Card {...card} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Styled Title */}
        <div 
          className="relative z-30 flex flex-col items-center cursor-default transition-transform duration-300 hover:scale-105"
          onMouseEnter={playHapticSound}
          onTouchStart={playHapticSound}
        >
          <h1 
            className="text-6xl sm:text-7xl md:text-8xl text-yellow-400 mb-1 text-center transition-colors duration-300 hover:text-yellow-300 whitespace-nowrap"
            style={{
              fontFamily: '"Luckiest Guy", cursive',
              WebkitTextStroke: '2px #222',
              textShadow: '0px 6px 0 #b45309, 0px 10px 20px rgba(0,0,0,0.7)',
              letterSpacing: '0.02em',
              lineHeight: '1.1'
            }}
          >
            <span className="md:hidden">CRICKET<br/>BATTLE</span>
            <span className="hidden md:inline">CRICKET - BATTLE</span>
          </h1>
        </div>

        {/* Floating Feature Badges */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-20">
          {[
            { emoji: '🃏', label: 'COLLECT', sub: 'CARDS', pos: 'top-[8%] left-[4%] sm:top-[12%] sm:left-[15%]', anim: 'animate-float' },
            { emoji: '🏏', label: 'DREAM 11', sub: 'BUILD', pos: 'top-[15%] right-[4%] sm:top-[20%] sm:right-[15%]', anim: 'animate-float-delayed' },
            { emoji: '⚡', label: 'REAL-TIME', sub: '1V1', pos: 'bottom-[45%] left-[2%] sm:bottom-[35%] sm:left-[10%]', anim: 'animate-float-slow' },
            { emoji: '🏆', label: 'WINNER', sub: 'GLORY', pos: 'bottom-[40%] right-[2%] sm:bottom-[30%] sm:right-[10%]', anim: 'animate-float' },
          ].map((f, i) => (
            <div 
              key={i}
              className={`absolute ${f.pos} ${f.anim} pointer-events-auto group cursor-default flex`}
              onMouseEnter={playHapticSound}
              onTouchStart={playHapticSound}
            >
              <div className="flex flex-col items-center justify-center bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-2 sm:p-4 rounded-2xl shadow-xl transform transition-transform group-hover:scale-110 group-hover:bg-slate-700/60">
                <span className="text-lg sm:text-3xl mb-0.5 sm:mb-1">{f.emoji}</span>
                <div className="text-center">
                  <p className="text-[8px] sm:text-xs font-black text-blue-400 leading-none tracking-tighter">{f.label}</p>
                  <p className="text-[6px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5 sm:mt-1">{f.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>


        {user ? (
          <div className="w-full flex flex-col gap-3 sm:gap-4">
            {/* Profile Card */}
            <div className="bg-slate-800/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-700/50 relative overflow-hidden group">
              <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0 transform group-hover:rotate-6 transition-transform">
                  <UserCircle className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Player Profile</p>
                  <p className="text-xl sm:text-2xl font-black text-white truncate">
                    {profile?.username || user.email?.split('@')[0]}
                  </p>
                  <div className="flex gap-3 sm:gap-4 mt-0.5">
                    <p className="text-xs text-slate-400">Wins: <span className="text-green-400 font-bold">{profile?.matches_won || 0}</span></p>
                    <p className="text-xs text-slate-400">Played: <span className="text-blue-400 font-bold">{profile?.matches_played || 0}</span></p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors text-slate-300"
                    title="Edit Profile"
                  >
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="text-[10px] sm:text-xs text-red-400 hover:text-red-300 font-bold uppercase"
                  >
                    Log out
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:gap-3">
              <button 
                onClick={() => navigate('/lobby')}
                className="w-full relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-orange-500 rounded-xl sm:rounded-2xl blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative w-full flex items-center justify-center gap-2 sm:gap-3 bg-slate-900 border border-slate-700/50 hover:bg-slate-800 transition-colors py-3 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-base sm:text-xl font-bold">
                  <Play className="fill-orange-400 text-orange-400 w-5 h-5 sm:w-6 sm:h-6" />
                  PLAY MULTIPLAYER
                </div>
              </button>

              <button 
                onClick={() => navigate(`/game/bot_match_${Date.now()}?role=host`)}
                className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-slate-800 border border-slate-700/50 hover:bg-slate-700 transition-colors py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-sm sm:text-lg font-bold text-slate-300"
              >
                <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px]">🤖</div>
                PLAY VS CPU
              </button>
            </div>

            {/* Secondary Buttons */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full">
              <button className="flex flex-col items-center justify-center bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-colors group">
                <Trophy className="text-yellow-400 w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-slate-300 text-xs sm:text-sm">Leaderboard</span>
              </button>
              <button className="flex flex-col items-center justify-center bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-colors group">
                <Users className="text-blue-400 w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-slate-300 text-xs sm:text-sm">My Deck</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-5 sm:p-6 rounded-2xl shadow-2xl">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-5 sm:mb-6 flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              Join the Action
            </h2>
            
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-xs sm:text-sm mb-4">{error}</div>}
            
            <div className="flex flex-col gap-3 sm:gap-4">
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm sm:text-base"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm sm:text-base"
              />
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-1 sm:mt-2">
                <button 
                  onClick={() => handleAuth('login')}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base"
                >
                  {loading ? '...' : 'Log In'}
                </button>
                <button 
                  onClick={() => handleAuth('signup')}
                  disabled={loading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base"
                >
                  {loading ? '...' : 'Sign Up'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
