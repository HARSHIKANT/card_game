import React, { useEffect, useState, useRef, memo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useGameStore } from '../store/useGameStore';
import { useBotEngine } from '../lib/useBotEngine';
import Card from '../components/Card';
import { Loader2, Clock, WifiOff, History, X } from 'lucide-react';
import { GameRole, PlayerCard } from '../types';
import CricketAnimationPanel from '../components/CricketAnimationPanel';

// ==========================================
// ScoreBoard Component (Extracted for Perf)
// ==========================================
const ScoreBoard = memo(({ role, hostName, guestName }: { role: GameRole, hostName: string, guestName: string }) => {
  const hostScore = useGameStore(s => s.hostScore);
  const guestScore = useGameStore(s => s.guestScore);
  const inning = useGameStore(s => s.inning);
  const turnNumber = useGameStore(s => s.turnNumber);
  const battingRole = useGameStore(s => s.battingRole);
  const timeLeft = useGameStore(s => s.timeLeft);

  return (
    <div className="w-full max-w-4xl bg-slate-800 rounded-xl sm:rounded-2xl px-3 py-3 sm:p-4 flex justify-between items-center border border-slate-700 shadow-xl relative">
      <div className="text-center min-w-0 flex-1">
        <p className="text-[10px] sm:text-sm text-slate-400 truncate">{hostName} {role === 'host' ? '(You)' : ''}</p>
        <p className="text-2xl sm:text-3xl font-bold">{hostScore}</p>
      </div>
      
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 px-3 sm:px-4 py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 shadow-lg whitespace-nowrap">
         <Clock className={`w-3 h-3 sm:w-4 sm:h-4 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} />
         <span className={`font-mono font-bold text-xs sm:text-sm ${timeLeft <= 5 ? 'text-red-400' : 'text-slate-200'}`}>
           00:{timeLeft.toString().padStart(2, '0')}
         </span>
      </div>

      <div className="text-center flex flex-col items-center flex-shrink-0 px-2 sm:px-4">
        <div className="bg-blue-600 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold mb-0.5 sm:mb-1">Inn {inning}/2</div>
        <p className="text-xs sm:text-base font-semibold hidden sm:block">{battingRole === 'host' ? `${hostName} Batting` : `${guestName} Batting`}</p>
        <p className="text-[9px] sm:hidden font-semibold text-blue-300">{battingRole === 'host' ? 'Host Bat' : 'Guest Bat'}</p>
        <p className="text-[9px] sm:text-sm text-slate-400">T: {turnNumber}/11</p>
      </div>
      <div className="text-center min-w-0 flex-1">
        <p className="text-[10px] sm:text-sm text-slate-400 truncate">{guestName} {role === 'guest' ? '(You)' : ''}</p>
        <p className="text-2xl sm:text-3xl font-bold">{guestScore}</p>
      </div>
    </div>
  );
});

// ==========================================
// PlayHistorySidebar Component
// ==========================================
const PlayHistorySidebar = memo(() => {
  const playHistory = useGameStore(s => s.playHistory);
  const [isOpen, setIsOpen] = useState(false);

  if (playHistory.length === 0) return null;

  return (
    <>
      {/* Toggle Button — repositioned for mobile so it doesn't overlap ScoreBoard */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-3 top-3 sm:right-4 sm:top-4 z-30 bg-slate-800 p-2 sm:p-2.5 rounded-full border border-slate-600 shadow-xl hover:bg-slate-700 transition-colors"
        title="Toggle Ball History"
      >
        <History className="w-4 h-4 sm:w-6 sm:h-6 text-slate-300" />
        {playHistory.length > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full leading-none">
            {playHistory.length}
          </span>
        )}
      </button>

      {/* Sidebar — full screen on mobile, side panel on desktop */}
      <div className={`fixed sm:absolute inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-72 bg-slate-800/98 backdrop-blur-md border-l border-slate-700 p-4 overflow-y-auto shadow-2xl z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-800/98 py-2 border-b border-slate-700 z-10">
          <h3 className="text-lg sm:text-xl font-bold text-slate-200">Ball History</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white bg-slate-700 p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
        {playHistory.map((item, idx) => (
          <div key={idx} className="bg-slate-700/50 p-3 rounded-xl border border-slate-600 shadow-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">
                Inn {item.inning} | Ball {item.turnNumber}
              </span>
              <span className={`text-lg font-black ${item.runs >= 4 ? 'text-orange-400' : 'text-green-400'}`}>
                +{item.runs}
              </span>
            </div>
            
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <img src={item.battingCard.image} alt="batting" className="w-8 h-8 rounded-full object-cover border border-slate-500 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-300 truncate font-semibold">Bat: {item.battingCard.name}</p>
                  <p className="text-slate-500 text-[10px]">Batting: {item.battingCard.batting} | Avg: {item.battingCard.average}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <img src={item.bowlingCard.image} alt="bowling" className="w-8 h-8 rounded-full object-cover border border-slate-500 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-300 truncate font-semibold">Bowl: {item.bowlingCard.name}</p>
                  <p className="text-slate-500 text-[10px]">Bowling: {item.bowlingCard.bowling} | Avg: {item.bowlingCard.average}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
});

// ==========================================
// Main GameBoard
// ==========================================
const GameBoard: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') as GameRole;
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();
  
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [animationRuns, setAnimationRuns] = useState<number | null>(null);
  const [ballId, setBallId] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isShortScreen, setIsShortScreen] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsShortScreen(window.innerHeight <= 650 && window.innerWidth > 640);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Initialize AI Engine
  useBotEngine(roomId || '');
  
  // Use atomic selectors to prevent mass re-renders
  const isBotMode = useGameStore(s => s.isBotMode);
  const status = useGameStore(s => s.status);
  const battingRole = useGameStore(s => s.battingRole);
  const myDeck = useGameStore(s => s.myDeck);
  const opponentDeckCount = useGameStore(s => s.opponentDeckCount);
  const mySelectedCard = useGameStore(s => s.mySelectedCard);
  const opponentReady = useGameStore(s => s.opponentReady);
  const opponentHiddenCard = useGameStore(s => s.opponentHiddenCard);
  const lastPlayResult = useGameStore(s => s.lastPlayResult);
  const opponentDisconnected = useGameStore(s => s.opponentDisconnected);
  const disconnectTimer = useGameStore(s => s.disconnectTimer);
  const hostScore = useGameStore(s => s.hostScore);
  const guestScore = useGameStore(s => s.guestScore);
  const turnNumber = useGameStore(s => s.turnNumber);

  // Fire animation on new result; reset when player picks their next card
  useEffect(() => {
    if (lastPlayResult !== null) {
      setAnimationRuns(lastPlayResult.runs);
      // We don't set isAnimating here anymore, we set it at the moment of trigger for better sync
    }
  }, [lastPlayResult]);

  useEffect(() => {
    if (mySelectedCard) setAnimationRuns(null);
  }, [mySelectedCard]);

  // Clear animation runs if status leaves 'playing'
  useEffect(() => {
    if (status !== 'playing') setAnimationRuns(null);
  }, [status]);

  const initGame = useGameStore(s => s.initGame);
  const setMyDeck = useGameStore(s => s.setMyDeck);
  const setBotDeck = useGameStore(s => s.setBotDeck);
  const startGame = useGameStore(s => s.startGame);
  const setOpponentDisconnected = useGameStore(s => s.setOpponentDisconnected);
  const selectCard = useGameStore(s => s.selectCard);
  const setOpponentHiddenCard = useGameStore(s => s.setOpponentHiddenCard);
  const applyResolvedTurn = useGameStore(s => s.applyResolvedTurn);
  const tickDisconnectTimer = useGameStore(s => s.tickDisconnectTimer);
  const tickTurnTimer = useGameStore(s => s.tickTurnTimer);

  const myDeckRef = useRef(myDeck);
  myDeckRef.current = myDeck;

  useEffect(() => {
    if (!user || !roomId || !role) {
      navigate('/');
      return;
    }

    const isBot = roomId.startsWith('bot_');
    initGame(roomId, role, user.id, isBot);

    const fetchDeck = async () => {
      const { data } = await supabase.from('players').select('*');
      if (data) {
        const shuffled = data.sort(() => 0.5 - Math.random());
        if (isBot) {
          setMyDeck(shuffled.slice(0, 11) as PlayerCard[]);
          setBotDeck(shuffled.slice(11, 22) as PlayerCard[]);
        } else {
          setMyDeck(shuffled.slice(0, 11) as PlayerCard[]);
        }
      }
    };
    fetchDeck();

    if (isBot) {
      setTimeout(() => {
        const tossWinner = Math.random() > 0.5 ? 'host' : 'guest';
        startGame(tossWinner);
      }, 1000);
      return;
    }

    const gameChannel = supabase.channel(`room_${roomId}`, {
      config: { presence: { key: user.id } }
    });

    gameChannel
      .on('presence', { event: 'sync' }, () => {
        const state = gameChannel.presenceState();
        const usersCount = Object.keys(state).length;
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id !== user.id) {
              setOpponentName(p.username || 'Opponent');
              setOpponentId(p.user_id);
            }
          });
        });

        if (useGameStore.getState().status === 'playing') {
          setOpponentDisconnected(usersCount < 2);
        }
      })
      .on('broadcast', { event: 'start_game' }, ({ payload }) => {
        startGame(payload.firstBatter);
      })
      .on('broadcast', { event: 'card_played' }, ({ payload }) => {
        if (payload.userId !== user.id) {
          setOpponentHiddenCard(payload.card);
          // Resolution is handled entirely inside handlePlayCard (2s delay)
          // so Host and Guest both reveal at the same time. Do NOT resolve here.
        }
      })
      .on('broadcast', { event: 'turn_resolved' }, ({ payload }) => {
         if (role === 'guest') {
            setAnimationRuns(payload.runs);
            setBallId(Date.now()); // Unique trigger
            setIsAnimating(true);
            setTimeout(() => {
               applyResolvedTurn(payload.runs, payload.opponentCard, payload.myCard);
               setIsAnimating(false);
            }, 1800); // Perfect sync for flight + reaction
         }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await gameChannel.track({ 
            user_id: user.id, 
            username: profile?.username || user.email?.split('@')[0] 
          });
          if (role === 'host') {
            setTimeout(() => {
              const tossWinner = Math.random() > 0.5 ? 'host' : 'guest';
              gameChannel.send({
                type: 'broadcast',
                event: 'start_game',
                payload: { firstBatter: tossWinner }
              });
              startGame(tossWinner);
            }, 500); // Reduced toss delay
          }
        }
      });

    setChannel(gameChannel);

    return () => {
      gameChannel.unsubscribe();
    };
  }, [user?.id, roomId, role, navigate, initGame, setMyDeck, setBotDeck, startGame, setOpponentDisconnected, setOpponentHiddenCard, applyResolvedTurn]);

  // Match Recording (multiplayer only — CPU matches are not recorded)
  useEffect(() => {
    if (status === 'finished' && user) {
      const isBot = roomId?.startsWith('bot_');
      if (isBot) return; // CPU matches don't count towards stats

      if (role === 'host') {
        const recordMatch = async () => {
          let winner_id: string | null = null;
          if (hostScore > guestScore) {
            winner_id = user.id;
          } else if (guestScore > hostScore && !isBot && opponentId) {
            winner_id = opponentId;
          }
          const { error } = await supabase.from('matches').insert({
            player1_id: user.id,
            player2_id: isBot ? null : opponentId,
            winner_id,
            p1_score: hostScore,
            p2_score: guestScore,
            status: 'completed'
          });
          if (!error) {
            setTimeout(() => fetchProfile(user.id), 1500);
          }
        };
        recordMatch();
      } else {
        setTimeout(() => fetchProfile(user.id), 4000);
      }
    }
  }, [status]);

  // Timers
  useEffect(() => {
    const timerId = setInterval(() => {
      const state = useGameStore.getState();
      if (state.opponentDisconnected) {
         tickDisconnectTimer();
      } else {
         tickTurnTimer(() => {
            const deck = myDeckRef.current;
            if (deck.length > 0 && !state.mySelectedCard) {
               const randomCard = deck[Math.floor(Math.random() * deck.length)];
               handlePlayCard(randomCard);
            }
         });
      }
    }, 1000);
    return () => clearInterval(timerId);
  }, [tickDisconnectTimer, tickTurnTimer]);

  // ── Centralized Turn Resolution (Host Side) ──
  useEffect(() => {
    if (role !== 'host' || !mySelectedCard || !opponentReady || isAnimating) return;
    
    const state = useGameStore.getState();
    let result = state.calculateAndResolveTurn();
    
    // Fallback if calculateAndResolveTurn returns null but cards exist
    if (!result && mySelectedCard && opponentHiddenCard) {
      const isBatting = battingRole === 'host';
      const battingPower = isBatting ? mySelectedCard.batting : opponentHiddenCard.batting;
      const bowlingPower = isBatting ? opponentHiddenCard.bowling : mySelectedCard.bowling;
      let runs = 0;
      const diff = battingPower - bowlingPower;
      if (diff > 40) runs = 6;
      else if (diff > 20) runs = 4;
      else if (diff > 0) runs = 2;
      else if (diff > -20) runs = 1;
      result = { runs, myCard: mySelectedCard, opponentCard: opponentHiddenCard };
    }

    if (result) {
      // Broadcast to guest
      const currentChannel = channel || supabase.getChannels().find(c => c.topic === `realtime:room_${roomId}`);
      if (currentChannel && !isBotMode) {
        currentChannel.send({ type: 'broadcast', event: 'turn_resolved', payload: result });
      }

      // Trigger Animation Instantly
      setAnimationRuns(result.runs);
      setBallId(Date.now());
      setIsAnimating(true);
      
      // Delay Final Result (Score update + Clear cards)
      setTimeout(() => {
        applyResolvedTurn(result!.runs, result!.myCard, result!.opponentCard);
        setIsAnimating(false);
      }, 1800);
    }
  }, [mySelectedCard, opponentReady, role, isAnimating, isBotMode]);

  const handlePlayCard = (card: PlayerCard) => {
    const isBot = roomId?.startsWith('bot_');
    const currentChannel = channel || supabase.getChannels().find(c => c.topic === `realtime:room_${roomId}`);
    if (useGameStore.getState().mySelectedCard || isAnimating) return; 
    
    selectCard(card);
    if (currentChannel && !isBot) {
      currentChannel.send({
        type: 'broadcast',
        event: 'card_played',
        payload: { userId: user?.id, card }
      });
    }
  };

  if (status === 'waiting') {
    return (
      <div className="w-full min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4 p-4">
        <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-orange-400 animate-spin" />
        <p className="text-base sm:text-xl text-center">Waiting for opponent to connect and toss coin...</p>
      </div>
    );
  }

  const amIBatting = battingRole === role;

  return (
    <div className="w-full min-h-screen bg-slate-950 flex text-white overflow-hidden relative">

      {/* ── Cricket Stadium Background (Full Screen) ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {status === 'playing' && (
          <CricketAnimationPanel 
            runs={animationRuns} 
            ballId={ballId} 
            isBothSelected={!!(mySelectedCard && opponentReady)}
          />
        )}
      </div>

      {/* ── Game Content ── */}
      <div className="h-screen w-full min-w-0 px-2 sm:px-4 flex flex-col items-center relative z-10 overflow-hidden">

      {/* Top Section: ScoreBoard - Compressed for Nest Hub */}
      <div className={`w-full px-4 sm:px-6 flex flex-col items-center flex-shrink-0 ${isShortScreen ? 'mt-0 mb-0 scale-90' : 'mt-1 sm:mt-2 mb-1 sm:mb-2'}`}>
        <ScoreBoard 
          role={role} 
          hostName={role === 'host' ? (profile?.username || 'You') : opponentName}
          guestName={role === 'guest' ? (profile?.username || 'You') : (isBotMode ? 'CPU' : opponentName)}
        />
        {opponentDisconnected && status !== 'forfeited' && (
          <div className="mt-1 bg-red-500 text-white px-4 py-0.5 rounded-full flex items-center gap-2 shadow-2xl animate-pulse border-2 border-red-300 text-[10px]">
            <WifiOff className="w-3 h-3" />
            <span className="font-bold">Opponent Disconnected! {disconnectTimer}s</span>
          </div>
        )}
      </div>

      <PlayHistorySidebar />

      {/* Middle Section: Battle Arena - Pushed up as much as possible */}
      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0">
        
        {/* Opponent Hand Section - Very compact */}
        <div className="w-full flex flex-col items-center mb-1 sm:mb-2 flex-shrink-0 h-[75px] sm:h-[105px]">
          <p className="text-slate-500 mb-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider">Opponent ({opponentDeckCount})</p>
          <div className="flex justify-center opacity-20 pointer-events-none scale-75 sm:scale-90">
             {Array.from({ length: Math.min(opponentDeckCount, 8) }).map((_, i) => (
               <div key={i} className="w-[45px] h-[65px] sm:w-[70px] sm:h-[105px] bg-slate-800 rounded shadow-md border border-slate-700 -ml-4 sm:-ml-6 first:ml-0" />
             ))}
          </div>
        </div>

        {/* Battle Area - Balanced for Nest Hub */}
        <div className={`flex gap-2 sm:gap-16 items-center justify-center min-h-[100px] sm:min-h-[245px] ${isShortScreen ? 'scale-[0.7] -my-10' : 'scale-[0.85] sm:scale-100'}`}>
           <div className="w-[100px] h-[170px] sm:w-[140px] sm:h-[245px] md:w-[155px] md:h-[270px] flex items-center justify-center">
             {opponentReady ? (
               mySelectedCard && opponentHiddenCard ? (
                 <div className="scale-75 sm:scale-100 transition-all duration-500 transform">
                    <Card {...opponentHiddenCard} />
                 </div>
               ) : (
                 <div className="w-full h-full bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-2xl flex items-center justify-center text-slate-400 animate-pulse text-[8px] sm:text-xs text-center p-2 border border-slate-700">
                    Card Played
                 </div>
               )
             ) : (
               <div className="w-full h-full border-2 border-dashed border-slate-800 bg-slate-900/40 rounded-xl flex items-center justify-center text-slate-600 text-[8px] sm:text-xs text-center p-2">
                  Waiting...
               </div>
             )}
           </div>

           <div className="text-xl sm:text-4xl font-black text-slate-800/60 drop-shadow-lg">VS</div>

           <div className="w-[100px] h-[170px] sm:w-[140px] sm:h-[245px] md:w-[155px] md:h-[270px] flex items-center justify-center">
             {mySelectedCard ? (
               <div className="scale-75 sm:scale-100 transition-all duration-500 transform">
                  <Card {...mySelectedCard} />
               </div>
             ) : (
               <div className="w-full h-full border-2 border-dashed border-blue-500/30 bg-blue-500/5 rounded-xl flex items-center justify-center text-blue-400/60 font-bold text-[8px] sm:text-xs text-center p-2 shadow-inner">
                  {amIBatting ? 'Pick Batsman' : 'Pick Bowler'}
               </div>
             )}
           </div>
        </div>
      </div>

      {/* ── Bottom Section: Your Hand - Pushed to the extreme bottom ── */}
      <div className="w-full pb-1 flex-shrink-0 relative z-20">
        <div className={`w-full transition-opacity duration-300 ${mySelectedCard ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-4">
              <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-orange-500/30"></div>
              <h2 className="text-[9px] sm:text-xs font-bold tracking-[0.2em] text-orange-500/60 uppercase">Your Hand</h2>
              <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-orange-500/30"></div>
            </div>
            
            {/* Hand Scroll Container - Fixed Clipping & Balanced for Nest Hub */}
            <div className={`w-full overflow-x-auto no-scrollbar pb-2 ${isShortScreen ? 'pt-2 mt-0' : 'pt-12 -mt-11'}`}>
              <div className={`flex justify-start sm:justify-center min-w-max mx-auto px-6 sm:px-10 ${isShortScreen ? '-space-x-8' : 'gap-2 sm:gap-4'}`}>
                 {myDeck.map((player) => (
                   <div 
                     key={player.id} 
                     onClick={() => !isAnimating && handlePlayCard(player)}
                     className={`transition-all duration-300 active:scale-95 py-0.5 
                        ${isAnimating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-3 hover:z-50'}
                        ${isShortScreen ? 'scale-[0.75] origin-bottom' : ''}
                     `}
                   >
                     <Card {...player} />
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Match Over Overlay */}
      {(status === 'finished' || status === 'forfeited') && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 sm:p-12 rounded-2xl sm:rounded-3xl border border-slate-700 text-center shadow-2xl w-full max-w-sm sm:max-w-md">
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-3 sm:mb-4">MATCH OVER</h2>
            <p className="text-lg sm:text-2xl text-slate-300 mb-6 sm:mb-8">
              {status === 'forfeited' ? "🏆 You Won! (Forfeit)" :
               hostScore === guestScore ? "It's a Tie!" : 
               (hostScore > guestScore && role === 'host') || (guestScore > hostScore && role === 'guest') 
               ? "🏆 You Won!" : "💀 You Lost!"}
            </p>
            <div className="flex justify-center gap-6 sm:gap-8 mb-6 sm:mb-8">
               <div className="text-center">
                 <p className="text-slate-400 text-sm">Host</p>
                 <p className="text-3xl sm:text-4xl font-bold text-white">{hostScore}</p>
               </div>
               <div className="text-center">
                 <p className="text-slate-400 text-sm">Guest</p>
                 <p className="text-3xl sm:text-4xl font-bold text-white">{guestScore}</p>
               </div>
            </div>
            <div className="flex flex-col gap-2 sm:gap-3">
              <button 
                onClick={() => navigate('/lobby')}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 sm:py-4 px-8 rounded-xl w-full text-base sm:text-lg shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-colors"
              >
                Play Again
              </button>
              <button 
                onClick={() => navigate('/')}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold py-2.5 sm:py-3 px-8 rounded-xl w-full text-sm sm:text-base transition-colors"
              >
                🏠 Go to Home
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end game content */}
    </div>
  );
};

export default GameBoard;
