import { useState, useEffect } from 'react';
import { api, type GitHubRelease } from '../api/client';

interface ReleaseInfoProps {
  owner: string;
  repo: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

type AssetCategory = 'Installers' | 'Archives' | 'Linux Packages' | 'Other';

function categorizeAsset(name: string): AssetCategory {
  const lower = name.toLowerCase();
  if (lower.endsWith('.dmg') || lower.endsWith('.exe') || lower.endsWith('.msi')) return 'Installers';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.zip') || lower.endsWith('.tar.xz') || lower.endsWith('.7z')) return 'Archives';
  if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm') || lower.endsWith('.snap')) return 'Linux Packages';
  return 'Other';
}

export function ReleaseInfo({ owner, repo }: ReleaseInfoProps) {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getRelease(owner, repo)
      .then(data => setRelease(data.release))
      .catch(() => setRelease(null))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  if (loading) return null;
  if (!release) return null;

  // Group assets by category
  const grouped = release.assets.reduce<Record<AssetCategory, typeof release.assets>>((acc, asset) => {
    const cat = categorizeAsset(asset.name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(asset);
    return acc;
  }, {} as Record<AssetCategory, typeof release.assets>);

  const categoryOrder: AssetCategory[] = ['Installers', 'Linux Packages', 'Archives', 'Other'];

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <path d="M12 2v6.5L10 7" />
          <path d="M12 2v6.5l2-1.5" />
          <path d="M4.93 10.93 2 14l2.93 3.07" />
          <path d="M2 14h6.5l-1.5-2" />
          <path d="M19.07 10.93 22 14l-2.93 3.07" />
          <path d="M22 14h-6.5l1.5-2" />
          <path d="M12 22v-6.5l-2 1.5" />
          <path d="M12 22v-6.5l2 1.5" />
        </svg>
        <h2 className="text-base font-semibold text-white">Latest Release</h2>
        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium ml-1">
          {release.tagName}
        </span>
      </div>

      {/* Release name and date */}
      <div className="mb-4">
        <p className="text-white text-sm font-medium">{release.name}</p>
        <p className="text-gray-500 text-xs mt-1">{formatTimeAgo(release.publishedAt)}</p>
      </div>

      {/* Assets */}
      {release.assets.length > 0 && (
        <div className="space-y-4">
          {categoryOrder.map(cat => {
            const assets = grouped[cat];
            if (!assets || assets.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-2">{cat}</p>
                <div className="space-y-1.5">
                  {assets.map(asset => (
                    <a
                      key={asset.name}
                      href={asset.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors group"
                    >
                      {/* Download icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-blue-400 transition-colors shrink-0">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>

                      {/* Filename */}
                      <span className="text-gray-300 text-xs font-mono truncate flex-1 min-w-0">
                        {asset.name}
                      </span>

                      {/* Download count */}
                      {asset.downloadCount > 0 && (
                        <span className="text-gray-600 text-[10px] shrink-0 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          {asset.downloadCount.toLocaleString()}
                        </span>
                      )}

                      {/* Size badge */}
                      <span className="text-[10px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                        {formatBytes(asset.size)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {release.assets.length === 0 && (
        <p className="text-gray-500 text-sm">No downloadable assets for this release.</p>
      )}
    </div>
  );
}
