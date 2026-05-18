import React, { useEffect, useState } from 'react';
import { audio } from '../lib/audio';
import { TossCall } from '../types';

interface Props {
  result: TossCall;
  onComplete: () => void;
}

const CoinTossAnimation: React.FC<Props> = ({ result, onComplete }) => {
  const [phase, setPhase] = useState<'tossing' | 'landing'>('tossing');

  useEffect(() => {
    audio.playCoinToss();

    const landingTimer = setTimeout(() => {
      setPhase('landing');
      audio.playCoinLand();
    }, 2000);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(landingTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // finalRotation: 0 for HEADS, 180 for TAILS
  const finalRotation = result === 'heads' ? 0 : 180;

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[100] flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-600/10 via-slate-900 to-slate-950 pointer-events-none" />

      {/* 3D Scene */}
      <div className="relative w-48 h-48 sm:w-64 sm:h-64" style={{ perspective: '1200px' }}>
        
        {/* Shadow that scales as the coin "rises" and "falls" */}
        <div 
          className="absolute bottom-[-50px] left-1/2 -translate-x-1/2 w-24 h-6 sm:w-32 sm:h-8 bg-black/60 rounded-[100%] blur-md"
          style={{
            animation: phase === 'tossing' ? `shadowScale 2s cubic-bezier(0.25, 1, 0.5, 1) forwards` : 'none',
            transform: phase !== 'tossing' ? 'translate(-50%, 0) scale(1)' : undefined
          }}
        />

        {/* The Coin Container */}
        <div 
          className="w-full h-full absolute top-0 left-0"
          style={{
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            animation: phase === 'tossing' ? `spinCoin 2s cubic-bezier(0.25, 1, 0.5, 1) forwards` : 'none',
            transform: phase !== 'tossing' ? `translateY(0) rotateY(${finalRotation}deg)` : undefined
          }}
        >
          {/* Edge/Thickness in the middle */}
          <div 
            className="absolute inset-0 rounded-full bg-yellow-600 shadow-[0_0_0_8px_#854d0e_inset] pointer-events-none" 
            style={{ 
              transform: 'translateZ(0px)',
              WebkitTransform: 'translateZ(0px)'
            }} 
          />

          {/* Front Face: HEADS pushed forward */}
          <div 
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,_#fde047,_#ca8a04_70%,_#713f12)] flex items-center justify-center border-[6px] border-yellow-300 shadow-[inset_0_0_20px_rgba(113,63,18,0.9)]"
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(2px)',
              WebkitTransform: 'rotateY(0deg) translateZ(2px)'
            }}
          >
            <div className="absolute inset-2 rounded-full border border-dashed border-yellow-700/40" />
            <span className="text-4xl sm:text-6xl font-black text-yellow-500 tracking-tighter" style={{ textShadow: '1px 2px 2px rgba(255,255,255,0.8), -1px -2px 3px rgba(0,0,0,0.6)' }}>
              HEADS
            </span>
          </div>

          {/* Back Face: TAILS pushed backward */}
          <div 
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,_#fde047,_#ca8a04_70%,_#713f12)] flex items-center justify-center border-[6px] border-yellow-300 shadow-[inset_0_0_20px_rgba(113,63,18,0.9)]"
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(2px)',
              WebkitTransform: 'rotateY(180deg) translateZ(2px)'
            }}
          >
            <div className="absolute inset-2 rounded-full border border-dashed border-yellow-700/40" />
            <span className="text-4xl sm:text-6xl font-black text-yellow-500 tracking-tighter" style={{ textShadow: '1px 2px 2px rgba(255,255,255,0.8), -1px -2px 3px rgba(0,0,0,0.6)' }}>
              TAILS
            </span>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes spinCoin {
          0% { transform: translateY(250px) rotateY(0deg); }
          40% { transform: translateY(-150px) rotateY(${1080 + finalRotation}deg); }
          100% { transform: translateY(0px) rotateY(${3600 + finalRotation}deg); }
        }
        @keyframes shadowScale {
          0% { transform: translate(-50%, 0) scale(1); opacity: 0.8; }
          40% { transform: translate(-50%, 0) scale(0.3); opacity: 0.2; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default CoinTossAnimation;
