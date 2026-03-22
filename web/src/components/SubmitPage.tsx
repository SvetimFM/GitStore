import { useState, useEffect } from 'react';
import { api, type Category } from '../api/client';

type Tab = 'repo' | 'source';

export function SubmitPage() {
  const [tab, setTab] = useState<Tab>('repo');
  const [categories, setCategories] = useState<Category[]>([]);

  // Repo form
  const [repoUrl, setRepoUrl] = useState('');
  const [repoCategoryId, setRepoCategoryId] = useState('');
  const [repoNote, setRepoNote] = useState('');
  const [repoSubmitting, setRepoSubmitting] = useState(false);
  const [repoSuccess, setRepoSuccess] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Source form
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceDescription, setSourceDescription] = useState('');
  const [sourceSubmitting, setSourceSubmitting] = useState(false);
  const [sourceSuccess, setSourceSuccess] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    api.getCollections()
      .then(data => setCategories(data.categories))
      .catch(() => {});
  }, []);

  const handleRepoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setRepoSubmitting(true);
    setRepoError(null);
    setRepoSuccess(false);

    try {
      await api.suggest('repo', repoUrl.trim(), repoCategoryId || undefined, repoNote.trim() || undefined);
      setRepoSuccess(true);
      setRepoUrl('');
      setRepoCategoryId('');
      setRepoNote('');
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to submit suggestion');
    } finally {
      setRepoSubmitting(false);
    }
  };

  const handleSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) return;

    setSourceSubmitting(true);
    setSourceError(null);
    setSourceSuccess(false);

    try {
      await api.suggest('source', sourceUrl.trim(), undefined, sourceDescription.trim() || undefined);
      setSourceSuccess(true);
      setSourceUrl('');
      setSourceDescription('');
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Failed to submit suggestion');
    } finally {
      setSourceSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-2 pt-4">
        <h1 className="text-3xl font-bold text-white">Suggest an App</h1>
        <p className="text-gray-500 text-base">Help us grow the GitStore catalog</p>
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5 max-w-xs mx-auto">
        <button
          onClick={() => setTab('repo')}
          className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            tab === 'repo'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Suggest a Repo
        </button>
        <button
          onClick={() => setTab('source')}
          className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            tab === 'source'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Suggest a Source
        </button>
      </div>

      {/* Suggest a Repo */}
      {tab === 'repo' && (
        <form onSubmit={handleRepoSubmit} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Suggest a Repository</h2>
            <p className="text-gray-500 text-sm">Submit a GitHub repo you'd like to see in GitStore.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">GitHub Repository URL <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={repoUrl}
                onChange={e => { setRepoUrl(e.target.value); setRepoSuccess(false); }}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Category</label>
              <select
                value={repoCategoryId}
                onChange={e => setRepoCategoryId(e.target.value)}
                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors appearance-none"
              >
                <option value="">Select a category (optional)</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Note / Reason</label>
              <textarea
                value={repoNote}
                onChange={e => setRepoNote(e.target.value)}
                placeholder="Why should this repo be included?"
                rows={3}
                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors resize-none"
              />
            </div>
          </div>

          {repoError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
              {repoError}
            </div>
          )}

          {repoSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">
              Suggestion submitted successfully. Thank you!
            </div>
          )}

          <button
            type="submit"
            disabled={repoSubmitting || !repoUrl.trim()}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {repoSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : 'Submit Suggestion'}
          </button>
        </form>
      )}

      {/* Suggest a Source List */}
      {tab === 'source' && (
        <form onSubmit={handleSourceSubmit} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Suggest a Source List</h2>
            <p className="text-gray-500 text-sm">Submit an awesome-list or curated repo list to import.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Awesome-List Repository URL <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={sourceUrl}
                onChange={e => { setSourceUrl(e.target.value); setSourceSuccess(false); }}
                placeholder="https://github.com/sindresorhus/awesome"
                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Description</label>
              <textarea
                value={sourceDescription}
                onChange={e => setSourceDescription(e.target.value)}
                placeholder="What kind of repos does this list contain?"
                rows={3}
                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors resize-none"
              />
            </div>
          </div>

          {sourceError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
              {sourceError}
            </div>
          )}

          {sourceSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">
              Source suggestion submitted successfully. Thank you!
            </div>
          )}

          <button
            type="submit"
            disabled={sourceSubmitting || !sourceUrl.trim()}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {sourceSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : 'Submit Source'}
          </button>
        </form>
      )}
    </div>
  );
}
