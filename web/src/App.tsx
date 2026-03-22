import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { AppCard } from './components/AppCard';
import { AppDetail } from './components/AppDetail';
import { InstalledApps } from './components/InstalledApps';
import { SubmitPage } from './components/SubmitPage';
import { FeaturedApps } from './components/FeaturedApps';
import { CategoryCard } from './components/CategoryCard';
import { CategoryPage } from './components/CategoryPage';
import { Onboarding, useOnboarding } from './components/Onboarding';
import { SettingsPage } from './components/SettingsPage';
import { TrendingSection } from './components/TrendingSection';
import { StarsPage } from './components/StarsPage';
import { ListsPage } from './components/ListsPage';
import { ListDetailPage } from './components/ListDetailPage';
import { useSearch } from './hooks/useSearch';
import { useDiscovery } from './hooks/useCollections';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { api, type RepoInfo } from './api/client';

function StorePage() {
  const { results, loading, error, search } = useSearch();
  const { categories, collections, featured, loading: discoveryLoading } = useDiscovery();
  const navigate = useNavigate();
  const [installingRepo, setInstallingRepo] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (query: string, opts?: { language?: string; minStars?: number }) => {
    setHasSearched(!!query.trim());
    search(query, opts);
  };

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
    <div className="space-y-10">
      {!hasSearched && (
        <div className="pt-4 pb-2">
          <h1
            className="text-5xl font-normal text-white tracking-tight leading-tight"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            Discover
          </h1>
          <p className="text-gray-400 text-lg mt-2">Curated open-source apps, ready to run.</p>
        </div>
      )}
      <SearchBar onSearch={handleSearch} loading={loading} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {hasSearched && results.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Search Results</h2>
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
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-400 text-lg">No results found</p>
          <p className="text-gray-600 text-sm mt-1">Try a different search query</p>
        </div>
      )}

      {!hasSearched && (
        <div className="space-y-12">
          <FeaturedApps apps={featured} loading={discoveryLoading} />

          <TrendingSection />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Browse Categories</h2>
              <span className="text-sm text-gray-500">{categories.length} categories</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categories.map(category => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  collectionCount={collections.filter(c => c.categoryId === category.id).length}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
    isActive ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
  }`;

function UpdateBanner() {
  const { update, dismiss } = useUpdateCheck();
  if (!update) return null;
  return (
    <div className="bg-blue-500/10 border-b border-blue-500/15 px-6 py-2.5 flex items-center justify-center gap-3 text-sm">
      <span className="text-blue-300">GitStore v{update.version} is available</span>
      <a
        href={update.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full hover:bg-blue-400 transition-colors"
      >
        Download Update
      </a>
      <button onClick={dismiss} className="text-blue-400/50 hover:text-blue-300 transition-colors ml-1" title="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}

function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <UpdateBanner />
      <nav className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">
              G
            </div>
            <span className="text-lg font-semibold text-white tracking-tight">GitStore</span>
          </NavLink>
          <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5">
            <NavLink
              to="/"
              end
              className={navLinkClass}
            >
              Discover
            </NavLink>
            <NavLink
              to="/my-apps"
              className={navLinkClass}
            >
              My Apps
            </NavLink>
            <NavLink
              to="/my-stars"
              className={navLinkClass}
            >
              My Stars
            </NavLink>
            <NavLink
              to="/lists"
              className={navLinkClass}
            >
              Lists
            </NavLink>
            <NavLink
              to="/submit"
              className={navLinkClass}
            >
              Submit
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<StorePage />} />
          <Route path="/my-apps" element={<InstalledApps />} />
          <Route path="/my-stars" element={<StarsPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:id" element={<ListDetailPage />} />
          <Route path="/app/:owner/:repo" element={<AppDetail />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { needsOnboarding, complete } = useOnboarding();

  if (needsOnboarding) {
    return <Onboarding onComplete={complete} />;
  }

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
