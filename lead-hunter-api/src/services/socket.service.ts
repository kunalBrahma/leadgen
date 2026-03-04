import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";

export class SocketService {
  private io?: Server;
  private queuedActions: Array<() => void> = [];

  public init(server: HttpServer): void {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      },
    });

    this.io.on("connection", (socket: Socket) => {
      console.log("[INFO] Client connected [ID: " + socket.id + "]");

      socket.on("disconnect", () => {
        console.log("[INFO] Client disconnected [ID: " + socket.id + "]");
      });
    });

    while (this.queuedActions.length > 0) {
      const act = this.queuedActions.shift();
      try {
        act && act();
      } catch (err) {
        console.warn("[WARNING] Error executing queued socket action:", err);
      }
    }
  }

  private getIOOrNull(): Server | undefined {
    return this.io;
  }

  public emitEvent(event: string, data: unknown): void {
    const io = this.getIOOrNull();
    if (io) {
      io.emit(event, data);
      return;
    }
    this.queuedActions.push(() => {
      const i = this.getIOOrNull();
      if (i) i.emit(event, data);
    });
  }

  public emitToRoom(room: string, event: string, data: unknown): void {
    const io = this.getIOOrNull();
    if (io) {
      io.to(room).emit(event, data);
      return;
    }
    this.queuedActions.push(() => {
      const i = this.getIOOrNull();
      if (i) i.to(room).emit(event, data);
    });
  }

  public joinRoom(socketId: string, room: string): void {
    const io = this.getIOOrNull();
    if (io) {
      const sock = io.sockets.sockets.get(socketId as any) as Socket | undefined;
      sock?.join(room);
      return;
    }
    this.queuedActions.push(() => {
      const i = this.getIOOrNull();
      if (i) {
        const s = i.sockets.sockets.get(socketId as any) as Socket | undefined;
        s?.join(room);
      }
    });
  }
}

export const socketService = new SocketService();
