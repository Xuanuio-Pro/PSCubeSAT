import { useCallback, useEffect, useState } from 'react';
import { request } from '../../contexts/auth-api';

export function useLmsResource(path, retain = false) {
  const [state, setState] = useState({ data: null, error: '', loading: true, path: null });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ data: retain && current.path === path ? current.data : null, error: '', loading: true, path }));
    request(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ data, error: '', loading: false, path });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ data: null, error: error.message, loading: false, path });
    });
    return () => controller.abort();
  }, [path, version, retain]);
  return { ...(state.path === path ? state : { data: null, error: '', loading: true }), reload };
}
