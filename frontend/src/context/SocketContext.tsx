import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './ToastContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { householdId, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to websocket backend
    const socketUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const s = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'],
    });

    s.on('connect', () => {
      console.log('Socket.io connected:', s.id);
      setIsConnected(true);

      // Join the household room if active
      if (householdId) {
        s.emit('join_household', householdId);
      }

      // Join the user's private room
      s.emit('join_user', user.id);
    });

    s.on('disconnect', () => {
      console.log('Socket.io disconnected');
      setIsConnected(false);
    });

    // Central listener: refresh ledger queries when updates occur
    s.on('ledger_update', (event: any) => {
      console.log('Ledger update received via WebSocket:', event);
      // Invalidate all React Query queries related to shared expenses, settlements, balances
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['settlementHistory'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    });

    s.on('new_notification', (notification: any) => {
      console.log('Real-time notification received via WebSocket:', notification);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast(notification.message, 'info');
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user, queryClient, showToast]);

  // Handle joining/leaving rooms dynamically on householdId change
  useEffect(() => {
    if (socket && isConnected) {
      if (householdId) {
        socket.emit('join_household', householdId);
      }
    }
  }, [householdId, socket, isConnected]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
