import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string, opts?: { language?: string; minStars?: number }) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [minStars, setMinStars] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, {
      language: language || undefined,
      minStars: minStars ? parseInt(minStars, 10) : undefined,
    });
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onSearch(value, {
      language: language || undefined,
      minStars: minStars ? parseInt(minStars, 10) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Search GitHub for apps... (e.g., 'markdown editor', 'todo api')"
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-lg"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={language}
          onChange={e => setLanguage(e.target.value)}
          placeholder="Language (e.g., TypeScript)"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <input
          type="number"
          value={minStars}
          onChange={e => setMinStars(e.target.value)}
          placeholder="Min stars"
          className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>
    </form>
  );
}
