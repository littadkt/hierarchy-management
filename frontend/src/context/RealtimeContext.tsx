"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";

export interface RealtimeEvent<T = any> {
  type: string;
  data: T;
  timestamp?: string;
}

type RealtimeCallback = (event: RealtimeEvent) => void;

interface RealtimeSubscriber {
  id: string;
  types: string[];
  callback: RealtimeCallback;
}

interface RealtimeContextType {
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
  subscribe: (types: string | string[], callback: RealtimeCallback) => () => void;
  broadcastLocal: (event: RealtimeEvent) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const subscribersRef = useRef<Map<string, RealtimeSubscriber>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const broadcastToSubscribers = useCallback((event: RealtimeEvent) => {
    setLastEvent(event);
    subscribersRef.current.forEach((sub) => {
      if (
        sub.types.includes("*") ||
        sub.types.includes(event.type) ||
        event.type === "RESYNC"
      ) {
        try {
          sub.callback(event);
        } catch (err) {
          console.error("[Realtime] Error in subscriber callback:", err);
        }
      }
    });
  }, []);

  const subscribe = useCallback(
    (types: string | string[], callback: RealtimeCallback) => {
      const id = Math.random().toString(36).substring(2, 9);
      const normalizedTypes = Array.isArray(types) ? types : [types];
      subscribersRef.current.set(id, {
        id,
        types: normalizedTypes,
        callback,
      });

      return () => {
        subscribersRef.current.delete(id);
      };
    },
    []
  );

  const broadcastLocal = useCallback(
    (event: RealtimeEvent) => {
      broadcastToSubscribers(event);
    },
    [broadcastToSubscribers]
  );

  useEffect(() => {
    if (!token || !user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let isSubscribed = true;
    const retryDelayRef = { current: 3000 };

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      try {
        const url = `/api/v1/realtime/events?token=${encodeURIComponent(token)}`;
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isSubscribed) {
            setIsConnected(true);
            retryDelayRef.current = 3000;
          }
        };

        es.onmessage = (e) => {
          if (!isSubscribed) return;
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.type === "ping") {
              return; // Keep-alive heartbeat
            }
            broadcastToSubscribers(parsed);
          } catch (err) {
            console.warn("[Realtime] Error parsing event:", err);
          }
        };

        es.onerror = () => {
          if (isSubscribed) {
            setIsConnected(false);
          }
          // Native EventSource auto-retries, but if readyState is CLOSED (e.g. backend offline), back off
          if (es.readyState === EventSource.CLOSED) {
            es.close();
            if (isSubscribed) {
              const delay = retryDelayRef.current;
              retryDelayRef.current = Math.min(delay * 1.5, 30000);
              if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isSubscribed) connectSSE();
              }, delay);
            }
          }
        };
      } catch (err) {
        if (isSubscribed) {
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(delay * 1.5, 30000);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isSubscribed) connectSSE();
          }, delay);
        }
      }
    };

    connectSSE();

    // Re-check on tab visibility (e.g. mobile unlock or waking from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connectSSE();
        }
        // Dispatch RESYNC event to refresh all active UI components
        broadcastToSubscribers({
          type: "RESYNC",
          data: { reason: "visibility_change" },
        });
      }
    };

    // Re-check on network online
    const handleOnline = () => {
      connectSSE();
      broadcastToSubscribers({
        type: "RESYNC",
        data: { reason: "network_online" },
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      isSubscribed = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [token, user, broadcastToSubscribers]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        lastEvent,
        subscribe,
        broadcastLocal,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
};

/**
 * Hook to subscribe to one or more real-time events.
 * Automatically cleans up the subscription when the component unmounts.
 */
export const useRealtimeEvent = (
  types: string | string[],
  callback: RealtimeCallback
) => {
  const { subscribe } = useRealtime();
  const callbackRef = useRef<RealtimeCallback>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsub = subscribe(types, (event) => {
      callbackRef.current?.(event);
    });
    return unsub;
  }, [subscribe, Array.isArray(types) ? types.join(",") : types]);
};

