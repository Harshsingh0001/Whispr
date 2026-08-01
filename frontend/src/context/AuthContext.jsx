import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import socket from '../socket/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('whispr_user');
    return stored ? JSON.parse(stored) : null;
  });

  // Whenever we have a logged-in user, make sure the socket is connected
  // and authenticated - this runs once on app load (page refresh case) and
  // again immediately after login/register.
  useEffect(() => {
    const token = localStorage.getItem('whispr_token');
    if (user && token) {
      if (!socket.connected) socket.connect();
      socket.emit('authenticate', { token });
    }
  }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persistSession(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    persistSession(data);
    return data;
  };

  const persistSession = (data) => {
    const { token, ...userData } = data;
    localStorage.setItem('whispr_token', token);
    localStorage.setItem('whispr_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('whispr_token');
    localStorage.removeItem('whispr_user');
    socket.disconnect();
    setUser(null);
  };

  const getToken = () => localStorage.getItem('whispr_token');

  return (
    <AuthContext.Provider value={{ user, login, register, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
