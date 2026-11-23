import { useEffect, useState, useSyncExternalStore } from "react";
import { getApiActivitySnapshot, subscribeApiActivity } from "../../services/api-client.js";

export function ApiProgressBar() {
  const activeRequests = useSyncExternalStore(subscribeApiActivity, getApiActivitySnapshot, () => 0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(activeRequests > 0), activeRequests > 0 ? 120 : 180);
    return () => window.clearTimeout(timer);
  }, [activeRequests]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-indigo-100/70" role="progressbar" aria-label="Loading">
      <div className="api-progress-bar h-full w-2/5 rounded-r-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.45)]" />
    </div>
  );
}
