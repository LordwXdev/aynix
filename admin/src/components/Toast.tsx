import { createContext, ReactNode, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

const ToastContext = createContext<(text: string, error?: boolean) => void>(() => {});

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? " error" : ""}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

// run an action, show a message, and report errors the same way everywhere
export const useAction = () => {
  const toast = useToast();
  return useCallback(
    async (work: () => Promise<unknown>, success: string) => {
      try {
        await work();
        toast(success);
        return true;
      } catch (err) {
        toast(err instanceof Error ? err.message : "Something went wrong", true);
        return false;
      }
    },
    [toast]
  );
};
