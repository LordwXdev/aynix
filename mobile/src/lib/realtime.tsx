import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { refreshSession, session } from "./api";
import { API_URL } from "./config";
import { useAuth } from "./auth";

const RealtimeContext = createContext<Socket | null>(null);

// one live connection while someone is logged in
export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const role = user?.role;
  const [socket, setSocket] = useState<Socket | null>(null);

  // reconnect when someone logs in, logs out, or their role changes
  useEffect(() => {
    if (!userId) return;
    const s = io(API_URL, {
      auth: (cb) => cb({ token: session.access }),
      transports: ["websocket"],
    });
    // screens get the socket once it is really connected
    s.on("connect", () => setSocket(s));
    s.on("connect_error", async (err) => {
      if (err.message.includes("token") && (await refreshSession())) s.connect();
    });
    return () => {
      s.close();
      setSocket(null);
    };
  }, [userId, role]);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
};

export const useSocket = () => useContext(RealtimeContext);

// run a handler whenever a live event arrives, while the screen is open
export const useLiveEvent = <T,>(event: string, handler: (data: T) => void) => {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
};
