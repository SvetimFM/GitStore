import { useState, useEffect } from 'react';

const ONBOARDED_KEY = 'gitstore-onboarded';

interface OnboardingProps {
  onComplete: () => void;
}

export function useOnboarding() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDED_KEY);
    if (!done) setNeedsOnboarding(true);
  }, []);

  const complete = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setNeedsOnboarding(false);
  };

  return { needsOnboarding, complete };
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [ghStatus, setGhStatus] = useState<'checking' | 'ok' | 'missing'>('checking');

  useEffect(() => {
    // Check if backend/gh is available by hitting the API
    fetch('/api/collections')
      .then(r => r.ok ? setGhStatus('ok') : setGhStatus('missing'))
      .catch(() => {
        // Try Tauri port
        fetch('http://127.0.0.1:3456/api/collections')
          .then(r => r.ok ? setGhStatus('ok') : setGhStatus('missing'))
          .catch(() => setGhStatus('missing'));
      });
  }, []);

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="flex flex-col items-center text-center space-y-6">
      <div className="w-20 h-20 rounded-2xl bg-[#3b82f6] flex items-center justify-center text-3xl font-bold shadow-xl shadow-blue-500/20">
        G
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-white">Welcome to GitStore</h1>
        <p className="text-gray-400 text-base max-w-md leading-relaxed">
          Your personal app store for GitHub. Discover, install, and run open-source apps with one click.
        </p>
      </div>
      <button
        onClick={() => setStep(1)}
        className="px-8 py-3 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
      >
        Get Started
      </button>
    </div>,

    // Step 1: Prerequisites
    <div key="prereqs" className="space-y-6 max-w-md w-full">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Quick Setup</h2>
        <p className="text-gray-400">GitStore needs a few things to work</p>
      </div>

      <div className="space-y-3">
        <PrereqItem
          icon="⚡"
          title="GitHub CLI (gh)"
          description="Used to search and fetch repos"
          status={ghStatus}
        />
        <PrereqItem
          icon="📦"
          title="Node.js"
          description="Required for most web apps"
          status="ok"
        />
        <PrereqItem
          icon="🔧"
          title="Git"
          description="Used to clone repositories"
          status="ok"
        />
      </div>

      {ghStatus === 'missing' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-sm">
          Install the GitHub CLI and run <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">gh auth login</code> to get started.
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setStep(0)}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-400 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(2)}
          className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
        >
          {ghStatus === 'missing' ? 'Skip for Now' : 'Continue'}
        </button>
      </div>
    </div>,

    // Step 2: Ready
    <div key="ready" className="flex flex-col items-center text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">You're All Set!</h2>
        <p className="text-gray-400 max-w-sm">
          Browse 800+ curated apps, search GitHub, or install anything with a single click.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center pt-2">
        <Tip icon="🔍" text="Search for any GitHub repo" />
        <Tip icon="📦" text="One-click install & run" />
        <Tip icon="🏠" text="Everything runs locally" />
      </div>
      <button
        onClick={onComplete}
        className="px-8 py-3 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
      >
        Open GitStore
      </button>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-10">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-blue-500' : i < step ? 'w-4 bg-blue-500/40' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}

function PrereqItem({ icon, title, description, status }: {
  icon: string;
  title: string;
  description: string;
  status: 'checking' | 'ok' | 'missing';
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{title}</p>
        <p className="text-gray-500 text-xs">{description}</p>
      </div>
      {status === 'checking' && (
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      )}
      {status === 'ok' && (
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      )}
      {status === 'missing' && (
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M12 9v4" /><path d="M12 17h.01" />
          </svg>
        </div>
      )}
    </div>
  );
}

function Tip({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-2xl">{icon}</span>
      <p className="text-gray-400 text-xs leading-relaxed">{text}</p>
    </div>
  );
}
