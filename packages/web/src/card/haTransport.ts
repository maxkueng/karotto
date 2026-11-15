import { CLIENT_ID_HEADER } from '@karotto/core';
import type {
  Transport,
  TransportResponse,
} from '@/api/transport';

/** The slice of home-assistant-js-websocket's Connection the card uses. */
export type HassConnection = {
  sendMessagePromise: <T>(message: Record<string, unknown>) => Promise<T>;
  subscribeMessage: <T>(
    callback: (message: T) => void,
    subscribe: Record<string, unknown>,
  ) => Promise<() => Promise<void>>;
  addEventListener: (
    event: 'ready',
    listener: () => void,
  ) => void;
  removeEventListener: (
    event: 'ready',
    listener: () => void,
  ) => void;
};

type StreamMessage
  = | {
    kind: 'event';
    type: string;
    event: unknown;
  }
  | { kind: 'resync' };

type HassError = {
  code?: string;
  message?: string;
};

function failure(error: unknown): TransportResponse {
  const {
    code = 'home_assistant',
    message = 'Home Assistant rejected the request',
  } = (error ?? {}) as HassError;
  return {
    status: code === 'unauthorized' ? 403 : 502,
    statusText: message,
    body: {
      error: {
        code,
        message,
      },
    },
  };
}

export function haTransport(
  connection: () => Promise<HassConnection>,
  configEntryId: string | undefined,
): Transport {
  const entry = configEntryId === undefined ? {} : { config_entry_id: configEntryId };

  return {
    send: async (
      method,
      path,
      body,
      headers,
    ) => {
      const clientId = headers[CLIENT_ID_HEADER];
      try {
        return await (await connection()).sendMessagePromise<TransportResponse>({
          type: 'karotto/request',
          method,
          path,
          ...(body === undefined ? {} : { body }),
          ...(clientId === undefined ? {} : { client_id: clientId }),
          ...entry,
        });
      } catch (error) {
        return failure(error);
      }
    },
    listen: (listeners) => {
      let stopped = false;
      let unsubscribe: (() => Promise<void>) | undefined;
      let ready: (() => void) | undefined;

      void connection().then(async (conn) => {
        if (stopped) {
          return;
        }
        ready = () => listeners.onReconnect();
        conn.addEventListener(
          'ready',
          ready,
        );
        const cancel = await conn.subscribeMessage<StreamMessage>(
          (message) => {
            if (message.kind === 'resync') {
              listeners.onReconnect();
            } else if (listeners.types.includes(message.type)) {
              listeners.onEvent(
                message.type,
                message.event,
              );
            }
          },
          {
            type: 'karotto/events',
            ...entry,
          },
        );
        if (stopped) {
          void cancel();
        } else {
          unsubscribe = cancel;
        }
      });

      return () => {
        stopped = true;
        void unsubscribe?.();
        void connection().then((conn) => {
          if (ready) {
            conn.removeEventListener(
              'ready',
              ready,
            );
          }
        });
      };
    },
  };
}
