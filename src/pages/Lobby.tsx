import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Swords, Shuffle, Trophy, Users, X, Bell, UserPlus, UserCheck, UserX, MessageCircle, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useGameStore } from '../store/useGameStore';
import LiveChat from '../components/LiveChat';

type Mode = 'quick' | 'friend' | null;
type FriendTab = 'friends' | 'pending' | 'search';

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
  const { user, profile, onlineUsers } = useAuth();

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

  // Friends system
  const [friendTab, setFriendTab] = useState<FriendTab>('friends');
  const [friends, setFriends] = useState<PlayerResult[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{profile: PlayerResult, friendshipId: string}[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [chatWithFriend, setChatWithFriend] = useState<PlayerResult | null>(null);
  const setActiveChatFriendId = useGameStore(state => state.setActiveChatFriendId);
  const [pingCooldown, setPingCooldown] = useState<string | null>(null); // userId of friend on cooldown
  const [receivedPings, setReceivedPings] = useState<{id: string, senderName: string, created_at: string}[]>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const quickChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const senderChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Sync active chat to store
  useEffect(() => {
    setActiveChatFriendId(chatWithFriend?.id || null);
    return () => setActiveChatFriendId(null);
  }, [chatWithFriend, setActiveChatFriendId]);

  // ─── Friends Helpers ────────────────────────────────────────────────────────
  const sortIds = (a: string, b: string): [string, string] => a < b ? [a, b] : [b, a];

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    setLoadingFriends(true);
    const { data } = await supabase
      .from('friendships')
      .select('user_id1, user_id2')
      .eq('status', 'accepted')
      .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);
    if (data && data.length > 0) {
      const friendIds = data.map(f => f.user_id1 === user.id ? f.user_id2 : f.user_id1);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email, matches_played, matches_won')
        .in('id', friendIds);
      setFriends(profiles || []);
    } else { setFriends([]); }
    setLoadingFriends(false);
  }, [user]);

  const fetchPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('id, user_id1, user_id2, action_user_id')
      .eq('status', 'pending')
      .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`)
      .neq('action_user_id', user.id);
    if (data && data.length > 0) {
      const senderIds = data.map(f => f.action_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email, matches_played, matches_won')
        .in('id', senderIds);
      setPendingRequests(data.map(f => ({
        friendshipId: f.id,
        profile: (profiles || []).find(p => p.id === f.action_user_id)!
      })).filter(r => r.profile));
    } else { setPendingRequests([]); }
  }, [user]);

  const fetchSentRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('user_id1, user_id2')
      .eq('status', 'pending')
      .eq('action_user_id', user.id);
    if (data) {
      setSentRequestIds(data.map(f => f.user_id1 === user.id ? f.user_id2 : f.user_id1));
    }
  }, [user]);

  const sendFriendRequest = async (targetId: string) => {
    if (!user) return;
    const [id1, id2] = sortIds(user.id, targetId);
    await supabase.from('friendships').upsert({
      user_id1: id1, user_id2: id2,
      action_user_id: user.id, status: 'pending'
    }, { onConflict: 'user_id1,user_id2' });
    setSentRequestIds(prev => [...prev, targetId]);
  };

  const respondToFriendRequest = async (friendshipId: string, accept: boolean) => {
    await supabase.from('friendships')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', friendshipId);
    fetchPending();
    if (accept) fetchFriends();
  };

  // Send a Ping to a friend (Broadcast + DB)
  const sendPing = async (target: PlayerResult) => {
    if (!user || !profile || pingCooldown === target.id) return;
    setPingCooldown(target.id);

    // 1. Persist to DB
    await supabase.from('pings').insert({
      sender_id: user.id,
      receiver_id: target.id,
    });

    // 2. Broadcast for instant delivery
    const ch = supabase.channel(`pings_${target.id}`);
    await new Promise<void>(r => ch.subscribe(s => s === 'SUBSCRIBED' && r()));
    await ch.send({
      type: 'broadcast', event: 'ping',
      payload: { from: user.id, fromName: profile.username, timestamp: Date.now() }
    });
    ch.unsubscribe();

    // 10s cooldown
    setTimeout(() => setPingCooldown(null), 10000);
  };

  // Fetch received pings for inbox
  const fetchReceivedPings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pings')
      .select('id, sender_id, is_read, created_at')
      .eq('receiver_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map(p => p.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', senderIds);
      const nameMap = new Map((profiles || []).map(p => [p.id, p.username]));
      setReceivedPings(data.map(p => ({
        id: p.id,
        senderName: nameMap.get(p.sender_id) || 'Unknown',
        created_at: p.created_at,
      })));
    } else { setReceivedPings([]); }
  }, [user]);

  const markAllPingsRead = async () => {
    if (!user) return;
    await supabase.from('pings')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    setReceivedPings([]);
  };

  useEffect(() => {
    if (mode === 'friend' && user) {
      fetchFriends();
      fetchPending();
      fetchSentRequests();
      fetchReceivedPings();
    }
  }, [mode, user]);

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

        {/* ── Friends & Search Panel ── */}
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

            {/* ── Friend Sub-Tabs ── */}
            <div className="w-full flex gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={() => setFriendTab('friends')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all ${friendTab === 'friends' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <UserCheck className="w-3.5 h-3.5" /> My Friends
              </button>
              <button
                onClick={() => setFriendTab('pending')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all relative ${friendTab === 'pending' ? 'bg-yellow-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <Bell className="w-3.5 h-3.5" /> Pending
                {pendingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFriendTab('search')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all ${friendTab === 'search' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </div>

            {/* ── My Friends Tab ── */}
            {friendTab === 'friends' && (
              <div className="flex flex-col gap-2">
                {loadingFriends ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-green-400 animate-spin" /></div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-10 flex flex-col items-center gap-3 text-slate-600">
                    <Users className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No friends yet. Search and add players!</p>
                  </div>
                ) : (
                  friends
                    .sort((a, b) => {
                      const aOnline = onlineUsers.has(a.id);
                      const bOnline = onlineUsers.has(b.id);
                      if (aOnline && !bOnline) return -1;
                      if (!aOnline && bOnline) return 1;
                      return a.username.localeCompare(b.username);
                    })
                    .map((friend) => {
                      const isOnline = onlineUsers.has(friend.id);
                      return (
                    <div key={friend.id} className="w-full bg-slate-800/80 border border-slate-700/50 hover:border-green-500/40 rounded-2xl p-4 flex items-center gap-3 transition-all group">
                      <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-lg">
                        {friend.username.charAt(0).toUpperCase()}
                        <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-800 ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-slate-500'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate text-sm leading-tight flex items-center gap-2">
                          {friend.username}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5 text-yellow-400" />
                            {friend.matches_won}W / {friend.matches_played}P
                          </span>
                          {friend.matches_played > 0 && (
                            <span className={`text-[10px] font-bold ${winRate(friend) >= 60 ? 'text-green-400' : winRate(friend) >= 40 ? 'text-yellow-400' : 'text-slate-400'}`}>
                              {winRate(friend)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => sendInvite(friend)}
                          disabled={!!sentInviteTo}
                          className="flex items-center gap-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          <Swords className="w-3 h-3" /> Challenge
                        </button>
                        <button
                          onClick={() => sendPing(friend)}
                          disabled={pingCooldown === friend.id}
                          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          <BellRing className="w-3 h-3" /> {pingCooldown === friend.id ? 'Sent!' : 'Ping'}
                        </button>
                        <button
                          onClick={() => setChatWithFriend(friend)}
                          className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          <MessageCircle className="w-3 h-3" /> Chat
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}

            {/* ── Inbox Tab (Friend Requests + Ping History) ── */}
            {friendTab === 'pending' && (
              <div className="flex flex-col gap-4">
                {/* Friend Requests Section */}
                {pendingRequests.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold px-1">Friend Requests</p>
                    {pendingRequests.map(({ profile: requester, friendshipId }) => (
                      <div key={friendshipId} className="w-full bg-slate-800/80 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3 transition-all">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-600 to-amber-600 flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-lg">
                          {requester.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold truncate text-sm">{requester.username}</p>
                          <p className="text-slate-400 text-[10px]">wants to be your friend</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => respondToFriendRequest(friendshipId, true)}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <UserCheck className="w-3 h-3" /> Accept
                          </button>
                          <button
                            onClick={() => respondToFriendRequest(friendshipId, false)}
                            className="flex items-center gap-1 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <UserX className="w-3 h-3" /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ping History Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Recent Pings</p>
                    {receivedPings.length > 0 && (
                      <button
                        onClick={markAllPingsRead}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {receivedPings.length === 0 && pendingRequests.length === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center gap-3 text-slate-600">
                      <Bell className="w-10 h-10 opacity-30" />
                      <p className="text-sm">Your inbox is empty</p>
                    </div>
                  ) : receivedPings.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-4">No pings yet</p>
                  ) : (
                    receivedPings.map((ping) => (
                      <div key={ping.id} className="w-full bg-slate-800/60 border border-blue-500/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BellRing className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">
                            <span className="text-blue-400 font-bold">{ping.senderName}</span> pinged you
                          </p>
                          <p className="text-slate-500 text-[10px] mt-0.5">
                            {new Date(ping.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(ping.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Search Tab ── */}
            {friendTab === 'search' && (
              <>
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

                {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="w-full text-center py-8 text-slate-500 text-sm">
                    No players found for "<span className="text-slate-300">{searchQuery}</span>"
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {searchResults.map((player) => {
                    const isFriend = friends.some(f => f.id === player.id);
                    const isRequested = sentRequestIds.includes(player.id);
                    return (
                      <div
                        key={player.id}
                        className="w-full bg-slate-800/80 border border-slate-700/50 hover:border-orange-500/40 rounded-2xl p-4 flex items-center gap-3 transition-all group"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-lg">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold truncate text-sm leading-tight">{player.username}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Trophy className="w-2.5 h-2.5 text-yellow-400" />
                              {player.matches_won}W / {player.matches_played}P
                            </span>
                            {player.matches_played > 0 && (
                              <span className={`text-[10px] font-bold ${winRate(player) >= 60 ? 'text-green-400' : winRate(player) >= 40 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                {winRate(player)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => sendInvite(player)}
                            disabled={!!sentInviteTo}
                            className="flex items-center gap-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Swords className="w-3 h-3" /> Challenge
                          </button>
                          {isFriend ? (
                            <span className="flex items-center gap-1 text-green-400 font-bold text-[10px] px-2.5 py-1.5">
                              <UserCheck className="w-3 h-3" /> Friend
                            </span>
                          ) : isRequested ? (
                            <span className="flex items-center gap-1 text-yellow-400 font-bold text-[10px] px-2.5 py-1.5">
                              <Bell className="w-3 h-3" /> Sent
                            </span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(player.id)}
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              <UserPlus className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {searchQuery.trim().length < 2 && !sentInviteTo && (
                  <div className="text-center py-8 flex flex-col items-center gap-3 text-slate-600">
                    <Search className="w-10 h-10 opacity-30" />
                    <p className="text-sm">Type at least 2 characters to find a player</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Friend Chat Overlay */}
      {chatWithFriend && user && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md h-[80vh] bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-white font-black text-sm">
                  {chatWithFriend.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{chatWithFriend.username}</p>
                  <p className="text-green-400 text-[10px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Ephemeral Chat
                  </p>
                </div>
              </div>
              <button onClick={() => setChatWithFriend(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <LiveChat
                mode="direct"
                recipientId={chatWithFriend.id}
                userId={user.id}
                userName={profile?.username || 'Player'}
                embedded
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;
