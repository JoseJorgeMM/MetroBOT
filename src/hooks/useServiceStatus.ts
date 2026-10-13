import { useEffect, useState } from 'react';
import { getServiceStatus } from '../lib/serviceStatusClient';
import { isFreshStatus, type ServiceSnapshot } from '../lib/serviceStatus';

/** Shared client deduplicates the home panel and route cards. Never persist offline status. */
export function useServiceStatus() {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(null);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      clearTimeout(timer);
      setSnapshot(current => current && isFreshStatus(current) ? current : null);
      const value = await getServiceStatus();
      if (disposed) return;
      setSnapshot(value);
      timer = setTimeout(() => void update(), isFreshStatus(value) ? Math.max(100, Date.parse(value.expiresAt) - Date.now()) : 30_000);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void update(); };
    void update();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      disposed = true; clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);
  return snapshot;
}
