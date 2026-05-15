import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { PlayerCard } from '../types';

export function useBotEngine(_roomId: string) {
  const isBotMode = useGameStore(s => s.isBotMode);
  const status = useGameStore(s => s.status);
  const battingRole = useGameStore(s => s.battingRole);
  const opponentReady = useGameStore(s => s.opponentReady);
  const botDeck = useGameStore(s => s.botDeck);
  const myDeck = useGameStore(s => s.myDeck); 
  const setOpponentHiddenCard = useGameStore(s => s.setOpponentHiddenCard);
  const removeBotCard = useGameStore(s => s.removeBotCard);
  const applyResolvedTurn = useGameStore(s => s.applyResolvedTurn);

  const botDeckRef = useRef(botDeck);
  botDeckRef.current = botDeck;

  useEffect(() => {
    if (!isBotMode || status !== 'playing' || opponentReady) return;

    const timer = setTimeout(() => {
      const currentBotDeck = botDeckRef.current;
      if (currentBotDeck.length === 0) return;

      const isBotBatting = battingRole === 'guest';
      let selectedCard: PlayerCard;

      if (isBotBatting) {
        // Find player's max bowling power to simulate Minimax
        const playerMaxBowling = Math.max(...myDeck.map(c => c.bowling), 0);
        
        // Sort bot's batting cards from weakest to strongest
        const sortedBatters = [...currentBotDeck].sort((a, b) => a.batting - b.batting);
        
        // Find weakest card that guarantees a Six (>40)
        selectedCard = sortedBatters.find(c => c.batting - playerMaxBowling > 40)
          // Or a Four (>20)
          || sortedBatters.find(c => c.batting - playerMaxBowling > 20)
          // Or a Two (>0)
          || sortedBatters.find(c => c.batting - playerMaxBowling > 0)
          // SACRIFICE PLAY: Play absolute worst batter if we can't beat their elite bowler
          || sortedBatters[0];
          
      } else {
        // Find player's max batting power
        const playerMaxBatting = Math.max(...myDeck.map(c => c.batting), 0);
        
        // Sort bot's bowling cards from weakest to strongest
        const sortedBowlers = [...currentBotDeck].sort((a, b) => a.bowling - b.bowling);
        
        // Find weakest card that forces a Wicket/Dot Ball (<= -20)
        selectedCard = sortedBowlers.find(c => playerMaxBatting - c.bowling <= -20)
          // Or limits to 0 runs (<= 0)
          || sortedBowlers.find(c => playerMaxBatting - c.bowling <= 0)
          // Or limits to 1 or 2 runs (<= 20)
          || sortedBowlers.find(c => playerMaxBatting - c.bowling <= 20)
          // SACRIFICE PLAY: Play absolute worst bowler if their batter is too strong
          || sortedBowlers[0];
      }

      // Play the card
      removeBotCard(selectedCard.id!);
      setOpponentHiddenCard(selectedCard);
      // Logic for resolution is now centralized in GameBoard.tsx useEffect
    }, 400 + Math.random() * 200); // 0.4s - 0.6s thinking delay

    return () => clearTimeout(timer);
  }, [isBotMode, status, opponentReady, battingRole, myDeck, setOpponentHiddenCard, removeBotCard]);
}
