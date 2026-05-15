import { create } from 'zustand';
import { audio } from '../lib/audio';
import { PlayerCard, GameRole, GameStatus, PlayResult, PlayHistoryItem } from '../types';

interface GameState {
  roomId: string | null;
  role: GameRole | null;
  userId: string | null;
  isBotMode: boolean;
  
  status: GameStatus;
  battingRole: GameRole | null;
  inning: number;
  hostScore: number;
  guestScore: number;
  turnNumber: number;
  
  timeLeft: number;
  opponentDisconnected: boolean;
  disconnectTimer: number;
  
  myDeck: PlayerCard[];
  initialMyDeck: PlayerCard[];
  botDeck: PlayerCard[];
  initialBotDeck: PlayerCard[];
  opponentDeckCount: number;
  mySelectedCard: PlayerCard | null;
  opponentHiddenCard: PlayerCard | null;
  opponentReady: boolean;
  
  lastPlayResult: PlayResult | null;
  playHistory: PlayHistoryItem[];

  // Actions
  initGame: (roomId: string, role: GameRole, userId: string, isBotMode?: boolean) => void;
  setMyDeck: (deck: PlayerCard[]) => void;
  setBotDeck: (deck: PlayerCard[]) => void;
  setOpponentDisconnected: (isDisconnected: boolean) => void;
  tickDisconnectTimer: () => void;
  tickTurnTimer: (onAutoPlay: () => void) => void;
  startGame: (firstBatter: GameRole) => void;
  
  selectCard: (card: PlayerCard) => void;
  setOpponentHiddenCard: (card: PlayerCard) => void;
  removeBotCard: (cardId: string | number) => void;
  
  // Host logic
  calculateAndResolveTurn: () => PlayResult | null;
  // Shared logic
  applyResolvedTurn: (runs: number, myCard: PlayerCard, opponentCard: PlayerCard) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  roomId: null,
  role: null,
  userId: null,
  isBotMode: false,
  
  status: 'waiting',
  battingRole: null,
  inning: 1,
  hostScore: 0,
  guestScore: 0,
  turnNumber: 1,
  
  timeLeft: 15,
  opponentDisconnected: false,
  disconnectTimer: 30,
  
  myDeck: [],
  initialMyDeck: [],
  botDeck: [],
  initialBotDeck: [],
  opponentDeckCount: 11,
  mySelectedCard: null,
  opponentHiddenCard: null,
  opponentReady: false,
  
  lastPlayResult: null,
  playHistory: [],
  
  initGame: (roomId, role, userId, isBotMode = false) => set({
    roomId, role, userId, isBotMode,
    // Full reset — prevents stale state from a previous match bleeding through
    status: 'waiting',
    battingRole: null,
    inning: 1,
    hostScore: 0,
    guestScore: 0,
    turnNumber: 1,
    timeLeft: 15,
    myDeck: [],
    initialMyDeck: [],
    botDeck: [],
    initialBotDeck: [],
    opponentDeckCount: 11,
    mySelectedCard: null,
    opponentHiddenCard: null,
    opponentReady: false,
    lastPlayResult: null,   // ← fixes "runs visible before game starts"
    playHistory: [],
    opponentDisconnected: false,
    disconnectTimer: 30,
  }),
  
  setMyDeck: (deck) => set({ myDeck: deck, initialMyDeck: deck, opponentDeckCount: deck.length }),
  
  setBotDeck: (deck) => set({ botDeck: deck, initialBotDeck: deck }),

  setOpponentDisconnected: (isDisconnected) => set({ 
    opponentDisconnected: isDisconnected,
    disconnectTimer: 30
  }),

  tickDisconnectTimer: () => {
    const current = get().disconnectTimer;
    if (current <= 1) {
       set({ status: 'forfeited' });
    } else {
       set({ disconnectTimer: current - 1 });
    }
  },

  tickTurnTimer: (onAutoPlay) => {
    if (get().status !== 'playing' || get().mySelectedCard) return;
    const current = get().timeLeft;
    if (current <= 1) {
       onAutoPlay();
    } else {
       set({ timeLeft: current - 1 });
    }
  },
  
  startGame: (firstBatter) => set({ 
    status: 'playing', 
    battingRole: firstBatter, 
    inning: 1, 
    hostScore: 0, 
    guestScore: 0,
    turnNumber: 1,
    timeLeft: 15,
    lastPlayResult: null,
    playHistory: []
  }),
  
  selectCard: (card) => {
    audio.playCardFlip();
    set({ mySelectedCard: card });
  },
  
  setOpponentHiddenCard: (card) => {
    audio.playCardFlip();
    set({ opponentHiddenCard: card, opponentReady: true });
  },

  removeBotCard: (cardId) => {
    set(state => ({ botDeck: state.botDeck.filter(c => c.id !== cardId) }));
  },
  
  calculateAndResolveTurn: () => {
    const state = get();
    if (state.role !== 'host') return null; // Only host calculates
    
    const myCard = state.mySelectedCard;
    const opponentCard = state.opponentHiddenCard;
    
    if (!myCard || !opponentCard) return null;
    
    const isBatting = state.battingRole === 'host';
    
    let battingPower: number, bowlingPower: number;
    if (isBatting) {
       battingPower = myCard.batting;
       bowlingPower = opponentCard.bowling;
    } else {
       battingPower = opponentCard.batting;
       bowlingPower = myCard.bowling;
    }
    
    let runs = 0;
    const diff = battingPower - bowlingPower;
    if (diff > 40) runs = 6;
    else if (diff > 20) runs = 4;
    else if (diff > 0) runs = 2;
    else if (diff > -20) runs = 1;
    else runs = 0; 
    
    return { runs, myCard, opponentCard };
  },

  applyResolvedTurn: (runs, myCard, opponentCard) => {
    // Audio is now handled by CricketAnimationPanel for frame-perfect sync

    let newHostScore = get().hostScore;
    let newGuestScore = get().guestScore;
    
    if (get().battingRole === 'host') newHostScore += runs;
    else newGuestScore += runs;
    
    let newDeck = get().myDeck.filter(c => c.id !== myCard.id);
    let newBotDeck = get().botDeck;
    let newOpponentDeckCount = get().opponentDeckCount - 1;
    
    let newInning = get().inning;
    let newBattingRole = get().battingRole;
    let newStatus = get().status;
    let newTurnNumber = get().turnNumber + 1;
    
    if (newTurnNumber > 11) {
       if (newInning === 1) {
          newInning = 2;
          newTurnNumber = 1;
          newBattingRole = newBattingRole === 'host' ? 'guest' : 'host';
          
          // Restore decks for inning 2
          newDeck = [...get().initialMyDeck];
          newBotDeck = [...get().initialBotDeck];
          newOpponentDeckCount = 11;
       } else {
          newStatus = 'finished';
       }
    }
    
    const isLocalBatting = get().battingRole === get().role;
    const battingCard = isLocalBatting ? myCard : opponentCard;
    const bowlingCard = isLocalBatting ? opponentCard : myCard;
    
    const newHistoryItem: PlayHistoryItem = {
      inning: get().inning,
      turnNumber: get().turnNumber,
      runs,
      battingCard,
      bowlingCard
    };
    
    set({
       hostScore: newHostScore,
       guestScore: newGuestScore,
       myDeck: newDeck,
       botDeck: newBotDeck,
       opponentDeckCount: newOpponentDeckCount,
       mySelectedCard: null,
       opponentHiddenCard: null,
       opponentReady: false,
       lastPlayResult: { runs, myCard, opponentCard },
       playHistory: [...get().playHistory, newHistoryItem],
       inning: newInning,
       battingRole: newBattingRole,
       status: newStatus,
       turnNumber: newTurnNumber,
       timeLeft: 15
    });
  }
}));
