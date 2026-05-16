import { useEffect, useRef, useState } from 'react';
import { audio } from '../lib/audio';

// Viewport and coordinate constants for SIDE-ON HORIZONTAL view
const VW = 1000;
const VH = 600;

// Pitch: Horizontal rectangle - SHIFTED UP to stay clear of the hand
const PITCH_W = 700;
const PITCH_H = 75;
const PITCH_X = (VW - PITCH_W) / 2;
const PITCH_Y = 260; // Moved UP significantly

// Equipment positions
const LEFT_SX = PITCH_X + 30;
const RIGHT_SX = PITCH_X + PITCH_W - 30;
const STUMP_Y = PITCH_Y + 15;
const BAT_X = LEFT_SX + 15;
const BAT_Y = STUMP_Y + 40;

interface Pt { x: number; y: number; age: number }
interface St { x: number; y: number; angle: number; vx: number; vy: number; va: number }
interface RS {
  batAngle: number; ballX: number; ballY: number; ballVis: boolean;
  trail: Pt[]; stumpsL: St[]; stumpsR: St[]; bailsL: St[]; bailsR: St[];
  flashAlpha: number; flashRed: boolean;
  label: string; labelColor: string; labelAlpha: number; labelScale: number;
  phase: string; runs: number | null; ambientT: number;
  capturedRuns: number;
}

function init(): RS {
  return {
    batAngle: 12, ballX: RIGHT_SX - 40, ballY: STUMP_Y - 10, ballVis: false,
    trail: [],
    stumpsL: [-12, 0, 12].map(dx => ({ x: LEFT_SX + dx, y: STUMP_Y + 45, angle: 0, vx: 0, vy: 0, va: 0 })),
    stumpsR: [-12, 0, 12].map(dx => ({ x: RIGHT_SX + dx, y: STUMP_Y + 45, angle: 0, vx: 0, vy: 0, va: 0 })),
    bailsL: [{ x: LEFT_SX - 6, y: STUMP_Y + 5, angle: 0, vx: 0, vy: 0, va: 0 }, { x: LEFT_SX + 6, y: STUMP_Y + 5, angle: 0, vx: 0, vy: 0, va: 0 }],
    bailsR: [{ x: RIGHT_SX - 6, y: STUMP_Y + 5, angle: 0, vx: 0, vy: 0, va: 0 }, { x: RIGHT_SX + 6, y: STUMP_Y + 5, angle: 0, vx: 0, vy: 0, va: 0 }],
    flashAlpha: 0, flashRed: false,
    label: '', labelColor: '#fff', labelAlpha: 0, labelScale: 0.5,
    phase: 'completed', runs: null, ambientT: 0,
    capturedRuns: 0,
  };
}

function StadiumBG({ t }: { t: number }) {
  const flicker = 0.92 + Math.sin(t * 0.12) * 0.08;
  
  return (
    <g>
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#010614" />
          <stop offset="60%" stopColor="#0a1e45" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="lightBeam" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="30" />
        </filter>
        <clipPath id="fieldClip">
          <path d={`M 0 180 Q ${VW/2} 130 ${VW} 180 L ${VW} ${VH} L 0 ${VH} Z`} />
        </clipPath>
      </defs>

      {/* 1.1 Sky */}
      <rect width={VW} height={VH} fill="url(#skyGrad)" />
      
      {/* 1.1 Stadium Wall */}
      <path d={`M 0 180 Q ${VW/2} 120 ${VW} 180 L ${VW} 240 L 0 240 Z`} fill="#0f172a" />

      {/* 1.3 Crowd dots */}
      <g opacity="0.4">
        {Array.from({ length: 200 }).map((_, i) => {
          const x = (i * 13) % VW;
          const y = 140 + (Math.floor(i / 20) * 6) + Math.sin(t * 0.05 + i) * 2;
          const colors = ["#fff", "#3b82f6", "#475569", "#f59e0b", "#ef4444"];
          return <circle key={i} cx={x} cy={y} r={1.3} fill={colors[i % 5]} />;
        })}
      </g>

      {/* 1.2 Floodlights */}
      {[120, VW - 120].map((tx, idx) => (
        <g key={idx}>
          <path 
            d={`M ${tx-60} 30 L ${tx+60} 30 L ${idx===0 ? tx+450 : tx-450} ${VH} L ${idx===0 ? tx-150 : tx+150} ${VH} Z`} 
            fill={`rgba(255, 255, 255, ${0.07 * flicker})`} 
            filter="url(#lightBeam)" 
          />
          <g filter="url(#glow)">
            {Array.from({ length: 5 }).map((_, r) => 
              Array.from({ length: 7 }).map((_, c) => (
                <circle 
                  key={`${r}-${c}`} 
                  cx={tx - 45 + c * 15} 
                  cy={30 + r * 15} 
                  r={6} 
                  fill={`rgba(255, 255, 255, ${flicker})`} 
                />
              ))
            )}
          </g>
        </g>
      ))}

      {/* 2.2 Green Field - Curved Horizon (Expanded) */}
      <path d={`M 0 180 Q ${VW/2} 130 ${VW} 180 L ${VW} ${VH} L 0 ${VH} Z`} fill="url(#grassGrad)" />
      
      {/* 2.2 Mowed Grass Stripes - Clipped to Curve */}
      <g clipPath="url(#fieldClip)">
        {Array.from({ length: 15 }).map((_, i) => {
          const x = i * (VW / 15);
          return (
            <rect 
              key={i} 
              x={x} 
              y={50} 
              width={VW / 30} 
              height={VH} 
              fill="rgba(255, 255, 255, 0.03)" 
            />
          );
        })}
      </g>

      {/* 2.4 Top Boundary Line (White Curved) */}
      <path d={`M 0 180 Q ${VW/2} 130 ${VW} 180`} fill="none" stroke="white" strokeWidth="3" opacity="0.6" />

      {/* 2.3 Boundary Line Arc (Bottom) */}
      <path d={`M 0 460 Q ${VW/2} 500 ${VW} 460`} fill="none" stroke="white" strokeWidth="3" opacity="0.4" />
      
      {/* 3.1 HORIZONTAL PITCH (Sandy Cream) */}
      <rect 
        x={PITCH_X} 
        y={PITCH_Y} 
        width={PITCH_W} 
        height={PITCH_H} 
        fill="#fde68a" 
        opacity="0.9" 
      />
      <line x1={PITCH_X + 60} y1={PITCH_Y} x2={PITCH_X + 60} y2={PITCH_Y + PITCH_H} stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
      <line x1={PITCH_X + PITCH_W - 60} y1={PITCH_Y} x2={PITCH_X + PITCH_W - 60} y2={PITCH_Y + PITCH_H} stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
    </g>
  );
}

export default function CricketAnimationPanel({ runs, ballId, isBothSelected }: { runs: number | null; ballId?: string | number; isBothSelected: boolean }) {
  const [rs, setRs] = useState<RS>(() => init());
  const p = useRef<RS>(init());
  const raf = useRef(0);
  const pVX = useRef(0), pVY = useRef(0), pGrav = useRef(0.4), pFrame = useRef(0);
  
  // Dynamic Viewport & Scaling Logic
  const [dims, setDims] = useState({ vbX: 0, vbY: 0, vW: VW, vH: VH, isMobile: false });

  useEffect(() => {
    const update = () => {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const ratio = sw / sh;
      const isMobile = sw < 640;
      
      if (ratio < 1) {
        const vW = 850; 
        const vH = vW / ratio;
        setDims({ vbX: 75, vbY: 300 - (vH / 2), vW, vH, isMobile });
      } else {
        setDims({ vbX: 0, vbY: 0, vW: VW, vH: VH, isMobile });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (runs === null) {
      const n = init();
      p.current = n;
      setRs({ ...n });
      return;
    }
    const s = p.current;
    s.runs = runs; 
    s.phase = 'idle'; // Reset to idle to trigger a new delivery
    s.batAngle = 45; 
    pFrame.current = 0;
    s.trail = []; 
    s.flashAlpha = 0; 
    s.labelAlpha = 0; 
    s.labelScale = 0.5; 
    s.ballVis = false;
    
    const labs: { [k: number]: { t: string; c: string } } = { 
      6: { t: 'SIX!', c: '#fbbf24' }, 4: { t: 'FOUR!', c: '#60a5fa' }, 2: { t: '2 RUNS', c: '#34d399' }, 1: { t: 'SINGLE', c: '#a3e635' }, 0: { t: 'WICKET!', c: '#f87171' } 
    };
    const lbl = labs[runs] || { t: `${runs} RUNS`, c: '#fff' };
    s.label = lbl.t; s.labelColor = lbl.c;
    
    s.stumpsL = [-12, 0, 12].map(dx => ({ x: LEFT_SX + dx, y: STUMP_Y + 45, angle: 0, vx: 0, vy: 0, va: 0 }));
    s.bailsL = [{ x: LEFT_SX - 6, y: STUMP_Y + 5, angle: 0, vx: 0, vy: 0, va: 0 }, { x: LEFT_SX + 6, y: STUMP_Y + 5, angle: 0, vx: 0, vy: 0, va: 0 }];
  }, [runs, ballId]);

  useEffect(() => {
    const tick = () => {
      raf.current = requestAnimationFrame(tick);
      const s = p.current;
      s.ambientT = (s.ambientT || 0) + 1;

      if (s.phase === 'idle') {
        if (s.runs === null) {
          pFrame.current = 0;
          setRs({ ...s });
          return;
        }
        pFrame.current++;
        if (pFrame.current >= 0) {
          s.phase = 'deliver'; pFrame.current = 0;
          s.ballX = RIGHT_SX; s.ballY = STUMP_Y + 10; s.ballVis = true;
          pVX.current = -20; pVY.current = -5;
          s.capturedRuns = s.runs ?? 0;
        }
      } else if (s.phase === 'deliver') {
        s.ballX += pVX.current; s.ballY += pVY.current; pVY.current += 0.3;
        if (s.ballY > STUMP_Y + 45 && pVY.current > 0) { pVY.current *= -0.4; s.ballY = STUMP_Y + 45; }

        // Start swinging only when ball is much closer (approx 5-6 frames away)
        if (s.ballX < BAT_X + 65) {
          s.phase = 'swing'; pFrame.current = 0;
        }
      } 
      
      if (s.phase === 'swing') {
        pFrame.current++;
        // Downswing: start at 70 degrees, reach 0 (impact) in 5-6 frames
        s.batAngle = 70 - pFrame.current * 14; 
        
        const prevX = s.ballX;
        s.ballX += pVX.current; s.ballY += pVY.current; pVY.current += 0.3;
        if (s.ballY > STUMP_Y + 45 && pVY.current > 0) { pVY.current *= -0.4; s.ballY = STUMP_Y + 45; }

        // PRECISION IMPACT DETECTION
        if (prevX > BAT_X && s.ballX <= BAT_X) {
          const r = s.capturedRuns;
          if (r > 0) {
            // TRIGGER IMPACT SOUND (Bat Crack + Crowd Roar)
            audio.playScoreSound(r);
            
            s.phase = 'flight'; pFrame.current = 0;
            // Snap to the SWEET SPOT of the bat (slightly above the toe)
            s.ballX = BAT_X; s.ballY = BAT_Y - 25; 
            s.flashAlpha = 0.5; s.flashRed = false;
            
            const cfg: { [k: number]: { vx: number; vy: number; grav: number } } = { 
              6: { vx: 25, vy: -20, grav: 0.5 }, 
              4: { vx: 24, vy: -6, grav: 0.8 }, 
              2: { vx: 16, vy: -12, grav: 0.7 }, 
              1: { vx: 12, vy: -10, grav: 0.7 } 
            };
            const c = cfg[r] || cfg[1];
            pVX.current = c.vx; pVY.current = c.vy; pGrav.current = c.grav;
          } else {
            // MISSED -> Continue to WICKET logic
          }
        }

        // WICKET logic (only if missed or runs=0)
        if (s.ballX < LEFT_SX + 15 && s.phase === 'swing') {
            s.phase = 'impact'; pFrame.current = 0;
            const hitStump = Math.abs(s.ballY - (STUMP_Y + 30)) < 50;
            s.flashAlpha = hitStump ? 0.6 : 0; s.flashRed = true;
            if (hitStump) {
              // TRIGGER WICKET SOUND (Stumps Shatter)
              audio.playWicket();
              
              s.stumpsL.forEach(st => { st.vx = (Math.random() - 0.5) * 15; st.vy = -(Math.random() * 12 + 8); st.va = (Math.random() - 0.5) * 0.6; });
              s.bailsL.forEach(b => { b.vx = (Math.random() - 0.5) * 18; b.vy = -(Math.random() * 14 + 10); b.va = (Math.random() - 0.5) * 0.7; });
            } else {
              // GENTLE MISS (Just a whoosh)
              audio.playMiss();
            }
        }
      } else if (s.phase === 'flight') {
        pFrame.current++;
        s.trail.push({ x: s.ballX, y: s.ballY, age: 0 });
        if (s.trail.length > 25) s.trail.shift();
        s.trail.forEach(t => { t.age += 0.04; });

        pVY.current += (pGrav.current || 0.4);
        s.ballX += pVX.current; s.ballY += pVY.current;

        if (s.ballY > STUMP_Y + 45 && pVY.current > 0) {
          pVY.current *= -0.65;
          s.ballY = STUMP_Y + 45;
        }

        s.labelAlpha = Math.min(1, s.labelAlpha + 0.1); 
        s.labelScale = Math.min(1, s.labelScale + 0.12);
        s.flashAlpha = Math.max(0, s.flashAlpha - 0.05);

        if (pFrame.current < 15) s.batAngle -= 4; // Follow through

        if (pFrame.current > 120 || s.ballX > VW + 100) { 
          s.phase = 'completed'; s.ballVis = false;
        }
      } else if (s.phase === 'impact') {
        pFrame.current++;
        s.labelAlpha = Math.min(1, s.labelAlpha + 0.1); s.labelScale = Math.min(1, s.labelScale + 0.12); s.flashAlpha = Math.max(0, s.flashAlpha - 0.025);
        s.stumpsL.forEach(st => { st.x += st.vx; st.y += st.vy; st.vy += 0.45; st.angle += st.va; });
        s.bailsL.forEach(b => { b.x += b.vx; b.y += b.vy; b.vy += 0.45; b.angle += b.va; });
        if (pFrame.current > 100) { s.phase = 'completed'; s.ballVis = false; }
      } else { 
        s.batAngle = 12 + Math.sin(s.ambientT * 0.04) * 6; 
      }
      
      setRs({ ...s, trail: [...s.trail], stumpsL: s.stumpsL.map(x => ({ ...x })), bailsL: s.bailsL.map(x => ({ ...x })) });
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#010411', overflow: 'hidden', position: 'relative' }}>
      <svg 
        viewBox={`${dims.vbX} ${dims.vbY} ${dims.vW} ${dims.vH}`} 
        style={{ width: '100%', height: '100%', display: 'block' }} 
        preserveAspectRatio="xMidYMid slice"
      >
        <StadiumBG t={rs.ambientT} />
        {rs.trail.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={Math.max(1, 10 * (1 - pt.age))} fill={`rgba(255,255,255,${0.35 * (1 - pt.age)})`} />
        ))}
        {rs.stumpsL.map((st, i) => (
          <g key={i} transform={`translate(${st.x},${st.y}) rotate(${st.angle * 57.3})`}>
            <rect x={-3} y={-45} width={6} height={45} rx={2} fill="#fef3c7" stroke="#d97706" strokeWidth={0.5} />
          </g>
        ))}
        {rs.bailsL.map((b, i) => (
          <g key={i} transform={`translate(${b.x},${b.y}) rotate(${b.angle * 57.3})`}>
            <rect x={-7} y={-2} width={14} height={4} rx={1} fill="#b45309" />
          </g>
        ))}
        {rs.stumpsR.map((st, i) => (
          <g key={i} transform={`translate(${st.x},${st.y})`}>
            <rect x={-3} y={-45} width={6} height={45} rx={2} fill="#fef3c7" stroke="#d97706" strokeWidth={0.5} />
          </g>
        ))}
        {rs.bailsR.map((b, i) => (
          <g key={i} transform={`translate(${b.x},${b.y})`}>
            <rect x={-7} y={-2} width={14} height={4} rx={1} fill="#b45309" />
          </g>
        ))}
        {/* Ball At Rest (In Bowler's Hand) - Making it glossy to match motion style */}
        {!rs.ballVis && (
          <g>
            <circle cx={RIGHT_SX - 35} cy={STUMP_Y + 40} r={8} fill="#ef4444" />
            <circle cx={RIGHT_SX - 35 - 3} cy={STUMP_Y + 40 - 3} r={2.5} fill="rgba(255,255,255,0.7)" />
          </g>
        )}
        {rs.ballVis && (
          <g filter="url(#glow)">
            <circle cx={rs.ballX} cy={rs.ballY} r={9} fill="#ef4444" />
            <circle cx={rs.ballX - 3} cy={rs.ballY - 3} r={2.5} fill="rgba(255,255,255,0.7)" />
          </g>
        )}
        {/* Bat - Pivoting around the top of the handle (BAT_Y - 95) */}
        <g transform={`rotate(${rs.batAngle},${BAT_X},${BAT_Y - 95})`}>
          <rect x={BAT_X - 4} y={BAT_Y - 95} width={8} height={35} rx={2} fill="#78350f" />
          <rect x={BAT_X - 12} y={BAT_Y - 60} width={24} height={70} rx={4} fill="#d97706" />
          <rect x={BAT_X - 9} y={BAT_Y - 58} width={18} height={66} rx={3} fill="#fbbf24" opacity="0.4" />
        </g>
        {rs.flashAlpha > 0 && <rect width={VW} height={VH} fill={rs.flashRed ? `rgba(239,68,68,${rs.flashAlpha})` : `rgba(251,191,36,${rs.flashAlpha})`} />}
        {rs.labelAlpha > 0 && (
          <g transform={`translate(${dims.vW / 2 + dims.vbX},${dims.vH * 0.3 + dims.vbY}) scale(${rs.labelScale * (dims.isMobile ? 0.65 : Math.max(0.45, Math.min(1, dims.vW / 1200)))})`} opacity={rs.labelAlpha}>
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontFamily="'Arial Black', sans-serif" fontWeight={900} fontSize={dims.isMobile ? 48 : 72} fill={rs.labelColor} style={{ filter: 'drop-shadow(0 0 25px rgba(0,0,0,0.9))' }}>
              {rs.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
