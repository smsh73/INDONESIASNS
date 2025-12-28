import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.REACT_APP_WS_URL || 'https://indonesia-sns-backend.azurewebsites.net';

class WebSocketService {
  private socket: Socket | null = null;

  connect(token?: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.subscribeToDashboard();
      this.subscribeToAlerts();
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToDashboard() {
    if (this.socket) {
      this.socket.emit('subscribe:dashboard');
    }
  }

  subscribeToAlerts() {
    if (this.socket) {
      this.socket.emit('subscribe:alerts');
    }
  }

  onDashboardUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('dashboard:update', callback);
    }
  }

  onNewAlert(callback: (alert: any) => void) {
    if (this.socket) {
      this.socket.on('new_alert', callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const wsService = new WebSocketService();

