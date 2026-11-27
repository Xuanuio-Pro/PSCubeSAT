import { useCallback, useEffect, useState } from 'react';
import { request } from '../../contexts/auth-api';

const resourceCache = new Map();

export function useLmsResource(path, retain = false) {
  const [state, setState] = useState(() => {
    const cached = resourceCache.get(path);
    return cached
      ? { data: cached, error: '', errorInfo: null, loading: false, path }
      : { data: null, error: '', errorInfo: null, loading: true, path: null };
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const cached = resourceCache.get(path);
    setState(current => ({
      data: cached || (retain ? current.data : null),
      error: '',
      errorInfo: null,
      loading: !cached && !(retain && current.data),
      path,
    }));
    request(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) {
        resourceCache.set(path, data);
        setState({ data, error: '', errorInfo: null, loading: false, path });
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        setState(current => ({
          data: retain ? current.data : null,
          error: error.message,
          // HTTP status and structured code ({ code: 'CONFIG_INVALID', ... }) so pages can choose retry vs. back.
          errorInfo: { status: error.status ?? 0, code: error.code || '' },
          loading: false,
          path,
        }));
      }
    });
    return () => controller.abort();
  }, [path, version, retain]);
  return {
    ...(state.path === path || (retain && state.data) ? state : { data: null, error: '', errorInfo: null, loading: true }),
    reload,
  };
}
