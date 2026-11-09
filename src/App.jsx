import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import MovieDetails from './pages/MovieDetails.jsx';
import Downloads from './pages/Downloads.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/movie/:id" element={<MovieDetails />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
