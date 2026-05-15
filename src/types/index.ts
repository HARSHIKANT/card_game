export interface PlayerCard {
  id?: number | string;
  name: string;
  image: string;
  role: string;
  batting: number;
  bowling: number;
  average: number;
  stars: number;
  objectposition?: string;
  scale?: number;
}

export interface PlayResult {
  runs: number;
  myCard: PlayerCard;
  opponentCard: PlayerCard;
}

export interface PlayHistoryItem {
  inning: number;
  turnNumber: number;
  runs: number;
  battingCard: PlayerCard;
  bowlingCard: PlayerCard;
}

export type GameRole = 'host' | 'guest';
export type GameStatus = 'waiting' | 'playing' | 'finished' | 'forfeited';

export interface UserProfile {
  id: string;
  email?: string;
}
