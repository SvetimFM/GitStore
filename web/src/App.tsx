import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { AppCard } from './components/AppCard';
import { AppDetail } from './components/AppDetail';
import { InstalledApps } from './components/InstalledApps';
import { useSearch } from './hooks/useSearch';
import { api, type RepoInfo } from './api/client';

function StorePage() {
  const { results, loading, error, search } = useSearch();
  const navigate = useNavigate();
  const [installingRepo, setInstallingRepo] = useState<string | null>(null);

  const handleInstall = async (repo: RepoInfo) => {
    setInstallingRepo(repo.fullName);
    try {
      await api.install(repo.fullName);
      navigate('/my-apps');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstallingRepo(null);
    }
  };

  const handleInspect = (repo: RepoInfo) => {
    navigate(`/app/${repo.owner}/${repo.name}`);
  };

  return (
    <div className="space-y-6">
      <SearchBar onSearch={search} loading={loading} />

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(repo => (
            <AppCard
              key={repo.fullName}
              repo={repo}
              onInstall={handleInstall}
              onInspect={handleInspect}
              installing={installingRepo === repo.fullName}
            />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to GitStore</h2>
          <p className="text-gray-400">Search GitHub to discover and install applications</p>
        </div>
      )}
    </div>
  );
}

function Layout() {
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold text-white tracking-tight">
            GitStore
          </NavLink>
          <div className="flex gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`
              }
            >
              Store
            </NavLink>
            <NavLink
              to="/my-apps"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`
              }
            >
              My Apps
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<StorePage />} />
          <Route path="/my-apps" element={<InstalledApps />} />
          <Route path="/app/:owner/:repo" element={<AppDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
