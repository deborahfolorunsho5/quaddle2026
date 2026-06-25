import { createContext, useContext, useEffect, useState } from "react";

import { api, getToken, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, if we have a stored token, fetch the user it belongs to.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => setToken(null)) // stale/invalid token
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { access_token } = await api.login(username, password);
    setToken(access_token);
    const me = await api.getMe();
    setUser(me);
    return me;
  };

  const register = async (data) => {
    await api.register(data);
    return login(data.username, data.password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);