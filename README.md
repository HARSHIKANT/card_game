# 🏏 Ultimate Cricket Strategy: Card Battle

A high-fidelity, real-time strategy card game that blends tactical card play with cinematic cricket simulation. Built for a premium, broadcast-quality experience across all devices.

## ✨ Key Features

- **Live Multiplayer**: Instant turn-based gameplay powered by **Supabase Realtime Broadcast**.
- **Advanced AI Engine**: Challenging "Play vs CPU" mode with reactive bot decision-making.
- **Cinematic Stadium**: High-fidelity SVG animation engine featuring:
  - Physics-based stump shattering and bails flying.
  - Dynamic ball trajectories with speed-dependent arcs.
  - Animated crowd and floodlight effects.
  - Authentic "Bat Crack" and "Crowd Roar" audio sync.
- **Broadcast-Grade UI**: Sleek scoreboard, live ball history, and premium match-up overlays.
- **Ephemeral Live Chat**: Instant, zero-latency communication between players (privacy-focused, no history recorded).

## 📱 Universal Device Support

The game is meticulously optimized for every form factor:

- **Desktop/PC**: Ultra-wide cinematic view with high-density UI.
- **Nest Hub (1024x600)**: Specialized **Short-Screen Optimization** with ultra-slim components and tailored scaling.
- **Mobile**: Responsive **Edge-to-Edge** pitch framing for immersive portrait play.

## 🕹️ Gameplay Mechanics

### Stat-Driven Results
The outcome of every ball is determined by a sophisticated comparison engine:
- **Comparison**: The Batsman's `batting` stat is compared against the Bowler's `bowling` stat.
- **Weighting**: The result is influenced by the player's `average` and a controlled randomness factor.
- **Outcomes**: 
  - **Match**: Close stats result in 1s and 2s.
  - **Dominance**: A high batting stat vs. low bowling results in 4s or 6s.
  - **Wicket**: A high bowling stat vs. low batting (or a lucky roll) triggers the "Stump Shatter" animation.

### Match Structure
- **Toss**: Automated toss at the start of the match decides the initial batting role.
- **Innings**: Each match consists of two innings. The Target is set after the first 11 balls (or when all wickets fall).
- **Roster**: Players select from a shuffled deck of 11 unique cards, managing their "Big Hitters" and "Strike Bowlers" strategically.

## 🏗️ Under the Hood

### Realtime Architecture
- **Supabase Broadcast**: Used for low-latency game events (card reveals, turn resolution). By using Broadcast instead of DB-polling, we achieve sub-100ms synchronization between players.
- **Presence**: Tracks opponent connection status. If a player leaves, a 30-second "Forfeit Timer" triggers to ensure match integrity.

### Animation Pipeline
The stadium is a custom **SVG-in-JS** engine. Unlike heavy Canvas or WebGL, this approach keeps the game lightweight and extremely sharp on high-DPI mobile screens and Nest Hub displays.

### Audio Synthesis
To keep the bundle size small, we use the **Web Audio API** to synthesize sounds (Oscillators) rather than loading large audio files. This creates instant, low-latency sound effects for bat impacts and misses.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (Mobile-First Architecture)
- **Backend/Realtime**: Supabase (Database, Auth, and Realtime Channels)
- **Icons**: Lucide React
- **Audio**: Web Audio API with Oscillator-based synthesis for instant feedback.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase Project

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env.local` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🎮 How to Play
1. **Choose your Role**: Play as Host or join a Room as Guest.
2. **Strategy**: Pick the right player card based on their Batting/Bowling stats and Average.
3. **Execution**: Both players reveal cards simultaneously. The difference in stats and a bit of luck determines the result (1, 2, 4, 6, or WICKET).
4. **Victory**: Outscore your opponent over the designated number of overs to win!

---
*Built with ❤️ for Cricket Fans everywhere.*
