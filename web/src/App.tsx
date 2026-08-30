import { useGame } from './useGame';
import Home from './Home';
import Lobby from './Lobby';
import Table from './Table';

export default function App() {
  const conn = useGame();

  if (!conn.view) return <Home conn={conn} />;
  if (conn.view.phase === 'lobby') return <Lobby conn={conn} view={conn.view} />;
  return <Table conn={conn} view={conn.view} />;
}
