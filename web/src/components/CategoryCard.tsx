import { useNavigate } from 'react-router-dom';
import type { Category } from '../api/client';

interface CategoryCardProps {
  category: Category;
  collectionCount: number;
}

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400' },
  green:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400' },
  red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400' },
  teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400' },
  yellow:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  text: 'text-yellow-400' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    text: 'text-pink-400' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    text: 'text-cyan-400' },
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  text: 'text-indigo-400' },
  slate:   { bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   text: 'text-slate-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
};

const fallback = { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400' };

export function CategoryCard({ category, collectionCount }: CategoryCardProps) {
  const navigate = useNavigate();
  const colors = colorMap[category.color ?? ''] ?? fallback;

  return (
    <div
      onClick={() => navigate(`/category/${category.id}`)}
      className={`${colors.bg} border ${colors.border} rounded-xl p-4 hover:scale-[1.02] transition-all duration-200 cursor-pointer group`}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{category.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">{category.name}</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {collectionCount} {collectionCount === 1 ? 'collection' : 'collections'}
          </p>
        </div>
        <svg className={`w-4 h-4 ${colors.text} opacity-0 group-hover:opacity-100 transition-opacity`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}
