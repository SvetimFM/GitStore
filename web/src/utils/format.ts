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
