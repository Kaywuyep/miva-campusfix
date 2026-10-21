import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

// Opens a real-time connection once the user is logged in.
// Pages listen for "request:updated" to refresh; new notifications pop up as toasts.
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const s = io(import.meta.env.VITE_SOCKET_URL || '/', { auth: { token: localStorage.getItem('token') } });
    s.on('notification', (n) => {
      toast(n.message, 'info');
      window.dispatchEvent(new CustomEvent('notifications:changed'));
    });
    setSocket(s);
    return () => s.disconnect();
  }, [user, toast]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

// Re-run `callback` whenever any request changes status (live updates)
export function useRequestUpdates(callback) {
  const socket = useContext(SocketContext);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('request:updated', callback);
    return () => socket.off('request:updated', callback);
  }, [socket, callback]);
}
