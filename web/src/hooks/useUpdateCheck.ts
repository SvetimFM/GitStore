import { useState, useEffect } from 'react';

const CURRENT_VERSION = '0.2.0';
const DISMISSED_KEY = 'gitstore-update-dismissed';

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseUrl: string;
}

export function useUpdateCheck() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't check if user already dismissed this session
    const dismissedVersion = sessionStorage.getItem(DISMISSED_KEY);

    fetch('https://api.github.com/repos/SvetimFM/GitStore/releases/latest')
      .then(r => r.json())
      .then(release => {
        if (!release.tag_name) return;
        const latest = release.tag_name.replace(/^v/, '');
        if (latest === CURRENT_VERSION) return;
        if (latest === dismissedVersion) return;

        // Simple semver comparison — newer if any segment is higher
        const cur = CURRENT_VERSION.split('.').map(Number);
        const lat = latest.split('.').map(Number);
        const isNewer = lat[0] > cur[0] ||
          (lat[0] === cur[0] && lat[1] > cur[1]) ||
          (lat[0] === cur[0] && lat[1] === cur[1] && lat[2] > cur[2]);

        if (!isNewer) return;

        setUpdate({
          version: latest,
          downloadUrl: `https://svetimfm.github.io/GitStore/download.html`,
          releaseUrl: release.html_url,
        });
      })
      .catch(() => {}); // Silent fail — don't bother user if offline
  }, []);

  const dismiss = () => {
    if (update) sessionStorage.setItem(DISMISSED_KEY, update.version);
    setDismissed(true);
  };

  return { update: dismissed ? null : update, dismiss };
}
