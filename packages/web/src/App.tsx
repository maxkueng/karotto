import {
  Navigate,
  Route,
  Router,
} from '@solidjs/router';
import type { RouteSectionProps } from '@solidjs/router';
import {
  Match,
  Switch,
} from 'solid-js';
import { Navbar } from '@/components/layout/Navbar';
import { Snackbars } from '@/components/ui/Snackbars';
import { LoginPage } from '@/pages/LoginPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TasksPage } from '@/pages/TasksPage';
import { LiveProvider } from '@/stores/live';
import { NotificationsProvider } from '@/stores/notifications';
import {
  SessionProvider,
  useSession,
} from '@/stores/session';
import { TagsProvider } from '@/stores/tags';
import { TasksProvider } from '@/stores/tasks';
import { twc } from '@/styles/twc';

const LoadingScreen = twc(
  'div',
  [
    'flex',
    'flex-1',
    'items-center',
    'justify-center',
    'text-gray-200',
  ],
);

const Main = twc(
  'main',
  [
    'flex',
    'flex-1',
    'flex-col',
    'pb-8',
  ],
);

function Shell(props: RouteSectionProps) {
  const session = useSession();
  return (
    <Switch>
      <Match when={session.status() === 'loading'}>
        <LoadingScreen>Loading…</LoadingScreen>
      </Match>
      <Match when={session.status() === 'anonymous'}>
        <Navigate href="/login" />
      </Match>
      <Match when={session.status() === 'authenticated'}>
        <TagsProvider>
          <TasksProvider>
            <LiveProvider>
              <Navbar />
              <Main>{props.children}</Main>
            </LiveProvider>
          </TasksProvider>
        </TagsProvider>
      </Match>
    </Switch>
  );
}

function LoginRoute() {
  const session = useSession();
  return (
    <Switch>
      <Match when={session.status() === 'authenticated'}>
        <Navigate href="/" />
      </Match>
      <Match when={session.status() !== 'authenticated'}>
        <LoginPage />
      </Match>
    </Switch>
  );
}

export function App() {
  return (
    <NotificationsProvider>
      <SessionProvider>
        <Snackbars />
        <Router>
          <Route
            path="/login"
            component={LoginRoute}
          />
          <Route
            path="/"
            component={Shell}
          >
            <Route
              path="/"
              component={TasksPage}
            />
            <Route
              path="/settings"
              component={SettingsPage}
            />
          </Route>
        </Router>
      </SessionProvider>
    </NotificationsProvider>
  );
}
