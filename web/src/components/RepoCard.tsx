import { useNavigate } from 'react-router-dom';
import { formatStars, langColors, githubAvatarUrl } from '../utils/format';

interface RepoCardProps {
  owner: string;
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  extra?: React.ReactNode;
}

export function RepoCard({ owner, name, description, stars, language, extra }: RepoCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/app/${owner}/${name}`)}
      className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <img
          src={githubAvatarUrl(owner)}
          alt={owner}
          className="w-11 h-11 rounded-xl shadow-md"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-white font-semibold text-sm truncate">{name}</h3>
            <span className="flex items-center gap-1 text-yellow-400/80 text-xs shrink-0 bg-yellow-400/10 px-2 py-0.5 rounded-full">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {formatStars(stars)}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5 truncate">{owner}</p>
          <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
            {description ?? 'No description'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 ml-14">
        {language && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${langColors[language] ?? 'bg-gray-500'}`} />
            {language}
          </span>
        )}
        {extra}
      </div>
    </div>
  );
}
