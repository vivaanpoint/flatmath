import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server | null = null;

export const initSocket = (server: HttpServer, frontendUrl: string) => {
  io = new Server(server, {
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    // Room subscription: join room based on householdId
    socket.on('join_household', (householdId: string | number) => {
      const room = `household_${householdId}`;
      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
    });

    socket.on('leave_household', (householdId: string | number) => {
      const room = `household_${householdId}`;
      socket.leave(room);
      console.log(`Client ${socket.id} left room: ${room}`);
    });

    socket.on('join_user', (userId: string | number) => {
      const room = `user_${userId}`;
      socket.join(room);
      console.log(`Client ${socket.id} joined user room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};

// Broadcasters
export const broadcastToHousehold = (householdId: number | string, event: string, data: any) => {
  if (io) {
    const room = `household_${householdId}`;
    io.to(room).emit(event, data);
    console.log(`Broadcasted event ${event} to room ${room}`);
  }
};

export const sendToUser = (userId: number | string, event: string, data: any) => {
  if (io) {
    const room = `user_${userId}`;
    io.to(room).emit(event, data);
    console.log(`Dispatched event ${event} to user room ${room}`);
  }
};
