import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { refreshSession, tokens } from "../api/client";

interface RealtimeState {
  socket: Socket | null;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeState>({ socket: null, connected: false });

// one live connection for the whole admin panel
export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // a function, so every reconnect sends the newest token
    const s = io({ auth: (cb) => cb({ token: tokens.access }), transports: ["websocket"] });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", async (err) => {
      setConnected(false);
      // token expired while we were away: refresh and connect again
      if (err.message.includes("token") && (await refreshSession())) {
        s.connect();
      }
    });

    setSocket(s);
    return () => {
      s.close();
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ socket, connected }}>{children}</RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);

// listen to one live event while the component is on screen
export const useLiveEvent = <T,>(event: string, handler: (data: T) => void) => {
  const { socket } = useRealtime();
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
};
