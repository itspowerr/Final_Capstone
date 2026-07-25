import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function useUnreadMessages() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!localStorage.getItem('access_token')) return;
    try {
      const { data } = await api.get('/messages/unread-count');
      setCount(data.count || 0);
    } catch {
      // Authentication errors are handled by the shared API interceptor.
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  return count;
}
