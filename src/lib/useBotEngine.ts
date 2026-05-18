import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { PlayerCard } from '../types';

export function useBotEngine(_roomId: string) {
  const isBotMode = useGameStore(s => s.isBotMode);
  const status = useGameStore(s => s.status);
  const opponentReady = useGameStore(s => s.opponentReady);
  const botDeck = useGameStore(s => s.botDeck);
  const setOpponentHiddenCard = useGameStore(s => s.setOpponentHiddenCard);
  const removeBotCard = useGameStore(s => s.removeBotCard);

  const botDeckRef = useRef(botDeck);
  botDeckRef.current = botDeck;

  useEffect(() => {
    if (!isBotMode || status !== 'playing' || opponentReady) return;

    const timer = setTimeout(() => {
      const currentBotDeck = botDeckRef.current;
      if (currentBotDeck.length === 0) return;

      // Purely random card selection
      const randomIndex = Math.floor(Math.random() * currentBotDeck.length);
      const selectedCard = currentBotDeck[randomIndex];
      console.log(randomIndex);

      // Play the card
      removeBotCard(selectedCard.id!);
      setOpponentHiddenCard(selectedCard);
      // Logic for resolution is now centralized in GameBoard.tsx useEffect
    }, 400 + Math.random() * 200); // 0.4s - 0.6s thinking delay

    return () => clearTimeout(timer);
  }, [isBotMode, status, opponentReady, setOpponentHiddenCard, removeBotCard]);
}
