import {
  createContext,
  createSignal,
  useContext,
} from 'solid-js';
import type {
  Accessor,
  ParentComponent,
} from 'solid-js';
import { ApiRequestError } from '@/api/client';

export type NotificationType = 'error' | 'success' | 'info';

export type NotificationAction = {
  label: string;
  run: () => void;
};

export type Notification = {
  id: number;
  type: NotificationType;
  text: string;
  action?: NotificationAction;
};

export type NotifyOptions = {
  action?: NotificationAction;
  durationMs?: number;
};

type NotificationsApi = {
  items: Accessor<Notification[]>;
  notify: (
    type: NotificationType,
    text: string,
    options?: NotifyOptions,
  ) => void;
  error: (error: unknown, fallback?: string) => void;
  dismiss: (id: number) => void;
};

const NotificationsContext = createContext<NotificationsApi>();

const AUTO_DISMISS_MS = 2500;

export const NotificationsProvider: ParentComponent = (props) => {
  const [
    items,
    setItems,
  ] = createSignal<Notification[]>([]);
  let nextId = 1;

  const dismiss = (id: number) => {
    setItems((list) => list.filter((item) => item.id !== id));
  };

  const notify = (
    type: NotificationType,
    text: string,
    options: NotifyOptions = {},
  ) => {
    const id = nextId;
    nextId += 1;
    const action = options.action
      ? {
          label: options.action.label,
          run: () => {
            dismiss(id);
            options.action?.run();
          },
        }
      : undefined;
    setItems((list) => [
      ...list.slice(-3),
      {
        id,
        type,
        text,
        ...(action ? { action } : {}),
      },
    ]);
    if (type !== 'error') {
      setTimeout(
        () => dismiss(id),
        options.durationMs ?? AUTO_DISMISS_MS,
      );
    }
  };

  const error = (
    err: unknown,
    fallback = 'Something went wrong',
  ) => {
    if (err instanceof ApiRequestError) {
      notify(
        'error',
        err.message || fallback,
      );
      return;
    }
    if (err instanceof Error && err.message) {
      notify(
        'error',
        err.message,
      );
      return;
    }
    notify(
      'error',
      fallback,
    );
  };

  return (
    <NotificationsContext.Provider value={{
      items,
      notify,
      error,
      dismiss,
    }}
    >
      {props.children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications(): NotificationsApi {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error('NotificationsProvider missing');
  }
  return value;
}
