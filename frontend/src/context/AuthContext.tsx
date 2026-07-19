import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  householdId: number | null;
  isLoading: boolean;
  login: (userData: User, token: string) => void;
  logout: () => Promise<void>;
  selectHousehold: (id: number | null) => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<number | null>(() => {
    const saved = localStorage.getItem('active_household_id');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const login = (userData: User, token: string) => {
    setUser(userData);
    setAccessToken(token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      console.error('Error logging out from backend:', err);
    } finally {
      setUser(null);
      setAccessToken(null);
      setHouseholdId(null);
      localStorage.removeItem('active_household_id');
      delete api.defaults.headers.common['Authorization'];
    }
  };

  const selectHousehold = (id: number | null) => {
    setHouseholdId(id);
    if (id) {
      localStorage.setItem('active_household_id', id.toString());
      api.defaults.headers.common['x-household-id'] = id.toString();
    } else {
      localStorage.removeItem('active_household_id');
      delete api.defaults.headers.common['x-household-id'];
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Attempt silent refresh to restore session
        const res = await api.post('/auth/refresh', {});
        const { user: userData, accessToken: token } = res.data.data;
        login(userData, token);
        if (householdId) {
          api.defaults.headers.common['x-household-id'] = householdId.toString();
        }
      } catch (err) {
        console.log('No active session / expired refresh token.');
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        householdId,
        isLoading,
        login,
        logout,
        selectHousehold,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
