import React from 'react';
import { GameRole, TossCall, TossDecision, GameStatus } from '../types';
import { Loader2 } from 'lucide-react';

interface Props {
  status: GameStatus;
  role: GameRole;
  tossCaller: GameRole | null;
  tossCall: TossCall | null;
  tossWinner: GameRole | null;
  onMakeCall: (call: TossCall) => void;
  onMakeDecision: (decision: TossDecision) => void;
}

const TossInteractionPanel: React.FC<Props> = ({
  status,
  role,
  tossCaller,
  tossCall,
  tossWinner,
  onMakeCall,
  onMakeDecision
}) => {
  if (status !== 'toss_call' && status !== 'toss_decision') return null;

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[90] flex flex-col items-center justify-center p-4">
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none" />

        {status === 'toss_call' && (
          <div className="text-center relative z-10">
            {tossCaller ? (
              // Someone already made a call
              <div className="flex flex-col items-center gap-6">
                <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Toss Called</h3>
                  <p className="text-slate-400">
                    {tossCaller === role 
                      ? `You called ${tossCall?.toUpperCase()}` 
                      : `Opponent called ${tossCall?.toUpperCase()}`}
                  </p>
                  <p className="text-sm text-yellow-500 mt-2 animate-pulse">Flipping coin...</p>
                </div>
              </div>
            ) : (
              // Need to make a call
              <>
                <h3 className="text-3xl font-black text-white mb-2">Coin Toss</h3>
                <p className="text-slate-400 mb-8">Call Heads or Tails before your opponent!</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => onMakeCall('heads')}
                    className="group relative overflow-hidden bg-gradient-to-b from-yellow-500 to-yellow-600 p-6 rounded-2xl border-b-4 border-yellow-700 hover:translate-y-1 hover:border-b-0 transition-all active:scale-95"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 text-xl font-black text-yellow-950 block">HEADS</span>
                  </button>
                  <button 
                    onClick={() => onMakeCall('tails')}
                    className="group relative overflow-hidden bg-gradient-to-b from-slate-400 to-slate-500 p-6 rounded-2xl border-b-4 border-slate-600 hover:translate-y-1 hover:border-b-0 transition-all active:scale-95"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10 text-xl font-black text-slate-900 block">TAILS</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {status === 'toss_decision' && (
          <div className="text-center relative z-10">
            {tossWinner === role ? (
              // Winner makes decision
              <>
                <div className="inline-block bg-yellow-500/20 text-yellow-400 font-bold px-4 py-1 rounded-full text-sm mb-4">
                  You won the toss!
                </div>
                <h3 className="text-3xl font-black text-white mb-8">What will you do?</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => onMakeDecision('bat')}
                    className="group relative bg-blue-600 p-6 rounded-2xl border-b-4 border-blue-800 hover:translate-y-1 hover:border-b-0 transition-all active:scale-95"
                  >
                    <span className="text-xl font-black text-white block mb-2">BAT</span>
                    <span className="text-xs text-blue-200">Set the target</span>
                  </button>
                  <button 
                    onClick={() => onMakeDecision('bowl')}
                    className="group relative bg-red-600 p-6 rounded-2xl border-b-4 border-red-800 hover:translate-y-1 hover:border-b-0 transition-all active:scale-95"
                  >
                    <span className="text-xl font-black text-white block mb-2">BOWL</span>
                    <span className="text-xs text-red-200">Defend the pitch</span>
                  </button>
                </div>
              </>
            ) : (
              // Loser waits
              <div className="flex flex-col items-center gap-6">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Opponent Won</h3>
                  <p className="text-slate-400">Waiting for them to choose Bat or Bowl...</p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default TossInteractionPanel;
