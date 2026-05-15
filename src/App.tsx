import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameBoard from './pages/GameBoard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:roomId" element={<GameBoard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
