import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Swords, Shuffle, Trophy, Users, X, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'quick' | 'friend' | null;

interface PlayerResult {
  id: string;
  username: string;
  email?: string;
  matches_played: number;
  matches_won: number;
}

interface IncomingInvite {
  from: string;
  fromName: string;
  roomId: string;
}

function Lobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Mode
  const [mode, setMode] = useState<Mode>(null);

  // Quick match
  const [isSearching, setIsSearching] = useState(false);
  const [quickStatus, setQuickStatus] = useState('Looking for opponent...');

  // Friend search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentInviteTo, setSentInviteTo] = useState<PlayerResult | null>(null);
  const [inviteDeclined, setInviteDeclined] = useState(false);

  // Incoming invite (can arrive in either mode)
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const quickChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const senderChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Search Players ───────────────────────────────────────────────────────
  const searchPlayers = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, email, matches_played, matches_won')
      .ilike('username', `%${query.trim()}%`)
      .neq('id', user?.id ?? '')
      .limit(8);
    setSearchResults(data || []);
    setSearching(false);
  }, [user?.id]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchPlayers(searchQuery), 400);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery, searchPlayers]);

  // ─── Send Invite ──────────────────────────────────────────────────────────
  const sendInvite = async (target: PlayerResult) => {
    if (!user) return;
    const roomId = `match_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setSentInviteTo(target);
    setInviteDeclined(false);

    // Send invite to target's personal channel
    const targetChannel = supabase.channel(`invites_${target.id}`);
    await new Promise<void>((res) => targetChannel.subscribe((s) => s === 'SUBSCRIBED' && res()));
    await targetChannel.send({
      type: 'broadcast',
      event: 'incoming_invite',
      payload: {
        from: user.id,
        fromName: profile?.username || user.email,
        roomId,
      },
    });
    targetChannel.unsubscribe();

    // Listen for acceptance/decline on OUR own personal channel
    const myChannel = supabase.channel(`invites_${user.id}_sender_${roomId}`);
    senderChannelRef.current = myChannel;

    myChannel
      .on('broadcast', { event: 'invite_accepted' }, ({ payload }) => {
        if (payload.roomId === roomId) {
          myChannel.unsubscribe();
          navigate(`/game/${roomId}?role=host`);
        }
      })
      .on('broadcast', { event: 'invite_declined' }, ({ payload }) => {
        if (payload.roomId === roomId) {
          setSentInviteTo(null);
          setInviteDeclined(true);
          myChannel.unsubscribe();
          setTimeout(() => setInviteDeclined(false), 3000);
        }
      })
      .subscribe();
  };

  const cancelInvite = () => {
    setSentInviteTo(null);
    senderChannelRef.current?.unsubscribe();
  };

  // ─── Accept / Decline ─────────────────────────────────────────────────────
  const respondToInvite = async (accept: boolean) => {
    if (!incomingInvite) return;
    const responseChannel = supabase.channel(`invites_${incomingInvite.from}_sender_${incomingInvite.roomId}`);
    await new Promise<void>((res) => responseChannel.subscribe((s) => s === 'SUBSCRIBED' && res()));
    await responseChannel.send({
      type: 'broadcast',
      event: accept ? 'invite_accepted' : 'invite_declined',
      payload: { roomId: incomingInvite.roomId },
    });
    responseChannel.unsubscribe();
    setIncomingInvite(null);
    if (accept) navigate(`/game/${incomingInvite.roomId}?role=guest`);
  };

  // ─── Personal invite listener (always active in Lobby) ───────────────────
  useEffect(() => {
    if (!user) { navigate('/'); return; }

    const personalChannel = supabase.channel(`invites_${user.id}`);
    personalChannel
      .on('broadcast', { event: 'incoming_invite' }, ({ payload }) => {
        setIncomingInvite({ from: payload.from, fromName: payload.fromName, roomId: payload.roomId });
      })
      .subscribe();

    return () => { personalChannel.unsubscribe(); };
  }, [user, navigate]);

  // ─── Quick Match Channel (only when user explicitly starts searching) ────
  useEffect(() => {
    if (!user || mode !== 'quick' || !isSearching) return;

    const channel = supabase.channel('matchmaking', {
      config: { presence: { key: user.id } },
    });
    quickChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState<any>();
        const usersInLobby: any[] = [];
        for (const id in newState) {
          if (newState[id][0]?.status === 'searching') {
            usersInLobby.push({ id, userId: newState[id][0].user_id, joinedAt: newState[id][0].joined_at });
          }
        }
        if (usersInLobby.length >= 2) {
          usersInLobby.sort((a, b) => a.joinedAt - b.joinedAt);
          const p1 = usersInLobby[0];
          const p2 = usersInLobby[1];
          if (user.id === p1.userId) {
            setQuickStatus('Match found! Creating room...');
            const roomId = `match_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            channel.send({ type: 'broadcast', event: 'match_found', payload: { roomId, p1: p1.userId, p2: p2.userId } });
            channel.untrack().then(() => navigate(`/game/${roomId}?role=host`));
          }
        } else {
          setQuickStatus('Looking for opponent...');
        }
      })
      .on('broadcast', { event: 'match_found' }, ({ payload }) => {
        if (payload.p2 === user.id || payload.p1 === user.id) {
          const role = payload.p1 === user.id ? 'host' : 'guest';
          channel.untrack().then(() => navigate(`/game/${payload.roomId}?role=${role}`));
        }
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, status: 'searching', joined_at: Date.now() });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [user, mode, isSearching, navigate]);

  const winRate = (p: PlayerResult) =>
    p.matches_played > 0 ? Math.round((p.matches_won / p.matches_played) * 100) : 0;

  return (
    <div className="w-full min-h-screen bg-slate-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-5 left-5 sm:top-6 sm:left-6 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm z-10"
      >
        <X className="w-4 h-4" /> Cancel
      </button>

      {/* ── Incoming Invite Popup ── */}
      {incomingInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-slate-800 border border-blue-500/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl shadow-blue-900/30 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Swords className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Challenge!</h3>
            <p className="text-slate-300 mb-6">
              <span className="text-orange-400 font-bold">{incomingInvite.fromName}</span> wants to battle you!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => respondToInvite(false)}
                className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold transition-colors text-slate-300"
              >
                Decline
              </button>
              <button
                onClick={() => respondToInvite(true)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 font-bold transition-all shadow-lg shadow-orange-900/30 text-white"
              >
                Accept 🏏
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="z-10 flex flex-col items-center w-full max-w-md px-4 pt-16 sm:pt-20 pb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-orange-400 mb-2 tracking-tight">
          Find a Match
        </h1>
        <p className="text-slate-400 text-sm mb-6 text-center">Challenge a random player or invite a friend directly.</p>

        {/* Mode Tabs — only show when a mode is already selected */}
        {mode !== null && (
          <div className="w-full flex gap-2 bg-slate-800/80 p-1 rounded-2xl border border-slate-700 mb-6">
            <button
              onClick={() => { setMode('quick'); setIsSearching(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'quick' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Shuffle className="w-4 h-4" /> Quick Match
            </button>
            <button
              onClick={() => { setMode('friend'); setIsSearching(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'friend' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4" /> Play with Friend
            </button>
          </div>
        )}

        {/* ── Landing: Choose Mode ── */}
        {mode === null && (
          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => setMode('quick')}
              className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-5 flex items-center gap-4 transition-all group text-left"
            >
              <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/30 transition-colors">
                <Shuffle className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">Quick Match</p>
                <p className="text-slate-400 text-sm mt-0.5">Get matched with a random online player instantly.</p>
              </div>
            </button>

            <button
              onClick={() => setMode('friend')}
              className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/50 rounded-2xl p-5 flex items-center gap-4 transition-all group text-left"
            >
              <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/30 transition-colors">
                <Users className="w-7 h-7 text-orange-400" />
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">Play with Friend</p>
                <p className="text-slate-400 text-sm mt-0.5">Search by username and challenge a specific player.</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Quick Match Panel ── */}
        {mode === 'quick' && (
          <div className="w-full flex flex-col items-center gap-6 py-10">
            {!isSearching ? (
              // Pre-search state — user chose Quick Match but hasn't started yet
              <>
                <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Shuffle className="w-12 h-12 text-blue-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-200 mb-1">Quick Match</h2>
                  <p className="text-slate-400 text-sm">You'll be matched with a random online player.</p>
                </div>
                <button
                  onClick={() => setIsSearching(true)}
                  className="w-full relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl blur opacity-60 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-slate-900 border border-blue-500/50 hover:bg-slate-800 transition-colors py-4 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2">
                    <Swords className="w-5 h-5 text-blue-400" />
                    Find Match
                  </div>
                </button>
              </>
            ) : (
              // Actively searching
              <>
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-200 mb-1">Matchmaking</h2>
                  <p className="text-slate-400 text-sm">{quickStatus}</p>
                </div>
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <button
                  onClick={() => setIsSearching(false)}
                  className="text-slate-500 hover:text-red-400 text-sm font-medium transition-colors"
                >
                  Cancel Search
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Friend Search Panel ── */}
        {mode === 'friend' && (
          <div className="w-full flex flex-col gap-4">

            {/* Invite sent state */}
            {sentInviteTo && (
              <div className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">Invite sent to {sentInviteTo.username}</p>
                  <p className="text-slate-400 text-xs">Waiting for them to accept...</p>
                </div>
                <button onClick={cancelInvite} className="text-slate-500 hover:text-red-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Declined notification */}
            {inviteDeclined && !sentInviteTo && (
              <div className="w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm font-medium text-center">
                Your invite was declined. Try someone else!
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full bg-slate-800 border border-slate-700 focus:border-orange-500 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all placeholder-slate-500 font-medium"
              />
              {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />}
            </div>

            {/* Search Results */}
            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
              <div className="w-full text-center py-8 text-slate-500 text-sm">
                No players found for "<span className="text-slate-300">{searchQuery}</span>"
              </div>
            )}

            <div className="flex flex-col gap-2">
              {searchResults.map((player) => (
                <div
                  key={player.id}
                  className="w-full bg-slate-800/80 border border-slate-700/50 hover:border-orange-500/40 rounded-2xl p-4 flex items-center gap-4 transition-all group"
                >
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-lg">
                    {player.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate text-base leading-tight">{player.username}</p>
                    {player.email && (
                      <p className="text-slate-500 text-[11px] truncate">{player.email}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                        {player.matches_won}W / {player.matches_played}P
                      </span>
                      {player.matches_played > 0 && (
                        <span className={`text-xs font-bold ${winRate(player) >= 60 ? 'text-green-400' : winRate(player) >= 40 ? 'text-yellow-400' : 'text-slate-400'}`}>
                          {winRate(player)}% WR
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Challenge button */}
                  <button
                    onClick={() => sendInvite(player)}
                    disabled={!!sentInviteTo}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-3 py-2 rounded-xl transition-all group-hover:shadow-lg group-hover:shadow-orange-900/30"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Challenge
                  </button>
                </div>
              ))}
            </div>

            {/* Hint when no search yet */}
            {searchQuery.trim().length < 2 && !sentInviteTo && (
              <div className="text-center py-8 flex flex-col items-center gap-3 text-slate-600">
                <Search className="w-10 h-10 opacity-30" />
                <p className="text-sm">Type at least 2 characters to find a player</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
