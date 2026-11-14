"use client";

import * as React from "react";

import { errorMessage } from "@/lib/api/client";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Small data-loading hook. The `key` should change whenever the request
 * parameters change. Requests are cancelled logically on unmount.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  key: string,
  enabled = true,
) {
  const loaderRef = React.useRef(loader);
  React.useEffect(() => {
    loaderRef.current = loader;
  });

  const [state, setState] = React.useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: enabled,
  });
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      // Clearing data when a query becomes disabled is intentional state sync.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: null, error: null, loading: false });
      return;
    }

    let active = true;
    setState((current) => ({
      data: current.data,
      error: null,
      loading: true,
    }));

    loaderRef
      .current()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ data: null, error: errorMessage(error), loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, [key, enabled, reloadToken]);

  const refresh = React.useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { ...state, refresh };
}
