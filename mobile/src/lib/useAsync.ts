import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "./api";

interface State<T> {
  data: T | null;
  error: string | null;
  doneFor: string | null; // which load the data belongs to
}

// load data for a screen, with reload() after actions and refresh() for pull-to-refresh
// it loads again whenever one of `deps` changes
export const useAsync = <T,>(load: () => Promise<T>, deps: unknown[]) => {
  // always call the newest version of `load`
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [state, setState] = useState<State<T>>({ data: null, error: null, doneFor: null });
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const waiting = useRef<(() => void)[]>([]);

  const runId = `${JSON.stringify(deps)}#${tick}`;

  useEffect(() => {
    let alive = true;
    loadRef
      .current()
      .then(
        (data) => alive && setState({ data, error: null, doneFor: runId }),
        (err) => alive && setState((s) => ({ ...s, error: errorText(err), doneFor: runId }))
      )
      .finally(() => {
        if (!alive) return;
        setRefreshing(false);
        // let anyone who called reload() know it is done
        waiting.current.splice(0).forEach((resolve) => resolve());
      });
    return () => {
      alive = false;
    };
  }, [runId]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current.push(resolve);
        setTick((t) => t + 1);
      }),
    []
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    return reload();
  }, [reload]);

  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return {
    data: state.data,
    error: state.error,
    loading: state.doneFor !== runId,
    refreshing,
    reload,
    refresh,
    setData,
  };
};
