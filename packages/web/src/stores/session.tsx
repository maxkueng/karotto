import type {
  DateFormat,
  DayContext,
  PreferencesUpdate,
  User,
} from '@karotto/core';
import {
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';
import type {
  Accessor,
  ParentComponent,
} from 'solid-js';
import {
  authApi,
  userApi,
} from '@/api';
import {
  ApiRequestError,
  onUnauthorized,
} from '@/api/client';
import { browserTimezone } from '@/lib/dates';

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

type SessionApi = {
  status: Accessor<SessionStatus>;
  user: Accessor<User | null>;
  dayContext: Accessor<DayContext>;
  dateFormat: Accessor<DateFormat>;
  login: (
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  updatePreferences: (patch: PreferencesUpdate) => Promise<void>;
  applyRemote: (user: User) => void;
};

const SessionContext = createContext<SessionApi>();

export const SessionProvider: ParentComponent = (props) => {
  const [
    status,
    setStatus,
  ] = createSignal<SessionStatus>('loading');
  const [
    user,
    setUser,
  ] = createSignal<User | null>(null);

  const dayContext = createMemo<DayContext>(() => {
    const current = user();
    return current
      ? {
          timezone: current.preferences.timezone,
          dayStart: current.preferences.dayStart,
        }
      : {
          timezone: browserTimezone(),
          dayStart: 0,
        };
  });

  const dateFormat = createMemo<DateFormat>(() => user()?.preferences.dateFormat ?? 'MM/dd/yyyy');

  const apply = (next: User) => {
    setUser(next);
    setStatus('authenticated');
  };

  const syncTimezone = async (current: User) => {
    const zone = browserTimezone();
    if (zone === current.preferences.timezone) {
      return current;
    }
    try {
      const updated = await userApi.updatePreferences({ timezone: zone });
      apply(updated);
      return updated;
    } catch {
      return current;
    }
  };

  const refresh = async () => {
    try {
      const current = await authApi.session();
      apply(current);
      return syncTimezone(current);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setUser(null);
        setStatus('anonymous');
        return null;
      }
      throw error;
    }
  };

  onMount(() => {
    void refresh();
  });

  onCleanup(onUnauthorized(() => {
    setUser(null);
    setStatus('anonymous');
  }));

  const login = async (
    username: string,
    password: string,
  ) => {
    const current = await authApi.login({
      username,
      password,
      timezone: browserTimezone(),
    });
    apply(current);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setStatus('anonymous');
  };

  const updatePreferences = async (patch: PreferencesUpdate) => {
    apply(await userApi.updatePreferences(patch));
  };

  return (
    <SessionContext.Provider value={{
      status,
      user,
      dayContext,
      dateFormat,
      login,
      logout,
      refresh,
      updatePreferences,
      applyRemote: apply,
    }}
    >
      {props.children}
    </SessionContext.Provider>
  );
};

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('SessionProvider missing');
  }
  return value;
}
