export function formatStars(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return String(stars);
}

export const langColors: Record<string, string> = {
  TypeScript: 'bg-blue-400',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-emerald-400',
  Rust: 'bg-orange-400',
  Go: 'bg-cyan-400',
  Java: 'bg-red-400',
  'C++': 'bg-pink-400',
  Ruby: 'bg-red-500',
  Swift: 'bg-orange-500',
  Kotlin: 'bg-purple-400',
  C: 'bg-gray-400',
  Shell: 'bg-green-400',
  PHP: 'bg-indigo-400',
};

export function githubAvatarUrl(owner: string, size = 96): string {
  return `https://github.com/${owner}.png?size=${size}`;
}

export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const runtimeIcons: Record<string, string> = {
  node: '🟢',
  python: '🐍',
  go: '🔵',
  rust: '🦀',
  docker: '🐳',
  static: '📄',
  binary: '⚡',
};
