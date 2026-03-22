import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string, opts?: { language?: string; minStars?: number }) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [minStars, setMinStars] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const buildOpts = () => ({
    language: language || undefined,
    minStars: minStars ? parseInt(minStars, 10) : undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, buildOpts());
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onSearch(value, buildOpts());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Search apps, tools, frameworks..."
          className="w-full pl-12 pr-24 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all text-[15px]"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading && (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              showFilters
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex gap-3 items-center">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
          >
            <option value="">Any language</option>
            {['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java', 'C++', 'Ruby', 'Swift', 'Kotlin'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={minStars}
            onChange={e => setMinStars(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
          >
            <option value="">Any stars</option>
            <option value="100">100+</option>
            <option value="500">500+</option>
            <option value="1000">1,000+</option>
            <option value="5000">5,000+</option>
            <option value="10000">10,000+</option>
          </select>
        </div>
      )}
    </form>
  );
}
