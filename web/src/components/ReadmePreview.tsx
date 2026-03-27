import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../api/client';

interface ReadmePreviewProps {
  owner: string;
  repo: string;
}

export function ReadmePreview({ owner, repo }: ReadmePreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.getReadme(owner, repo)
      .then(data => { if (!cancelled) setHtml(DOMPurify.sanitize(data.html)); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [owner, repo]);

  useEffect(() => {
    if (contentRef.current && html) {
      setNeedsCollapse(contentRef.current.scrollHeight > 400);
    }
  }, [html]);

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h2 className="text-base font-semibold text-white">README</h2>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-3/4 rounded animate-shimmer" />
          <div className="h-4 w-full rounded animate-shimmer" />
          <div className="h-4 w-5/6 rounded animate-shimmer" />
          <div className="h-4 w-2/3 rounded animate-shimmer" />
          <div className="h-4 w-full rounded animate-shimmer" />
          <div className="h-4 w-1/2 rounded animate-shimmer" />
        </div>
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h2 className="text-base font-semibold text-white">README</h2>
        </div>
        <p className="text-gray-500 text-sm">README not available for this repository.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <h2 className="text-base font-semibold text-white">README</h2>
      </div>

      <div className="relative">
        <div
          ref={contentRef}
          className={`readme-content overflow-hidden transition-[max-height] duration-300 ${
            !expanded && needsCollapse ? 'max-h-[400px]' : ''
          }`}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {needsCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0d0d14] to-transparent pointer-events-none" />
        )}
      </div>

      {needsCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5"
        >
          {expanded ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6" />
              </svg>
              Show less
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}
