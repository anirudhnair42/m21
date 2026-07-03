"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * A tiny global snackbar. Any component under <SnackbarProvider> can call
 * `useSnackbar().notify(message)` to surface an error (or info) toast that
 * auto-dismisses. Built because several failures — most visibly a sign-in
 * attempt when Google auth isn't configured — used to fail silently.
 */

type Variant = "error" | "info";
type Snack = { id: number; message: string; variant: Variant };

type SnackbarApi = {
  notify: (message: string, variant?: Variant) => void;
};

const SnackbarContext = createContext<SnackbarApi | null>(null);

export function useSnackbar(): SnackbarApi {
  const ctx = useContext(SnackbarContext);
  // Degrade to console instead of throwing, so a missing provider (e.g. in a
  // test harness) can never break the flow that was trying to report an error.
  return ctx ?? { notify: (m) => console.error("[snackbar]", m) };
}

const AUTODISMISS_MS = 6000;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setSnacks((cur) => cur.filter((s) => s.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: Variant = "error") => {
      const id = ++nextId.current;
      setSnacks((cur) => [...cur, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTODISMISS_MS);
    },
    [dismiss],
  );

  return (
    <SnackbarContext.Provider value={{ notify }}>
      {children}
      <div className="snackbar-stack" role="status" aria-live="assertive">
        {snacks.map((s) => (
          <div key={s.id} className={`snackbar snackbar-${s.variant}`}>
            <span className="snackbar-msg">{s.message}</span>
            <button
              className="snackbar-close"
              onClick={() => dismiss(s.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}
