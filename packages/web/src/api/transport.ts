export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type TransportResponse = {
  status: number;
  statusText: string;
  body: unknown;
};

export type EventListeners = {
  types: readonly string[];
  onEvent: (
    type: string,
    event: unknown,
  ) => void;
  onReconnect: () => void;
};

/** Carries API requests and the live event stream; HTTP in the browser, Home Assistant's websocket in the card. */
export type Transport = {
  send: (
    method: Method,
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ) => Promise<TransportResponse>;
  listen: (listeners: EventListeners) => () => void;
};

export const BASE = '/api/v1';

export const httpTransport: Transport = {
  send: async (
    method,
    path,
    body,
    headers,
  ) => {
    const response = await fetch(
      `${BASE}${path}`,
      {
        method,
        credentials: 'same-origin',
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? null : JSON.stringify(body),
      },
    );
    const text = response.status === 204 ? '' : await response.text();
    return {
      status: response.status,
      statusText: response.statusText,
      body: text ? JSON.parse(text) as unknown : null,
    };
  },
  listen: (listeners) => {
    const source = new EventSource(`${BASE}/events`);
    let interrupted = false;
    source.addEventListener(
      'open',
      () => {
        if (interrupted) {
          interrupted = false;
          listeners.onReconnect();
        }
      },
    );
    source.addEventListener(
      'error',
      () => {
        interrupted = true;
      },
    );
    listeners.types.forEach((type) => source.addEventListener(
      type,
      (message: MessageEvent<string>) => listeners.onEvent(
        type,
        JSON.parse(message.data) as unknown,
      ),
    ));
    return () => source.close();
  },
};

let current = httpTransport;

export function transport(): Transport {
  return current;
}

export function setTransport(next: Transport): void {
  current = next;
}
