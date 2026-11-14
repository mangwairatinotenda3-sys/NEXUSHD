import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import MovieDetails from './pages/MovieDetails.jsx';
import FreeFilms from './pages/FreeFilms.jsx';
import Library from './pages/Library.jsx';
import Downloads from './pages/Downloads.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import Legal from './pages/Legal.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/movie/:id" element={<MovieDetails kind="movie" />} />
          <Route path="/tv/:id" element={<MovieDetails kind="tv" />} />
          <Route path="/free" element={<FreeFilms />} />
          <Route path="/library" element={<Library />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/legal/:doc" element={<Legal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
            }
