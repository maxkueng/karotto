import {
  Navigate,
  Route,
  Router,
} from '@solidjs/router';
import type { RouteSectionProps } from '@solidjs/router';
import {
  Match,
  Show,
  Switch,
} from 'solid-js';
import { Navbar } from '@/components/layout/Navbar';
import { Snackbars } from '@/components/ui/Snackbars';
import {
  DISPLAY_PATH,
  isDisplayPath,
} from '@/lib/display';
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
    'text-neutral-200',
  ],
);

const Main = twc(
  'main',
  [
    'flex',
    'flex-1',
    'flex-col',
  ],
  {
    variants: {
      display: {
        true: [
          'h-dvh',
          'flex-none',
          'overflow-hidden',
        ],
        false: ['pb-8'],
      },
    },
    defaultVariants: { display: 'false' },
  },
);

function Shell(props: RouteSectionProps) {
  const session = useSession();
  const display = () => props.location.pathname === DISPLAY_PATH;
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
              <Show when={!display()}>
                <Navbar />
              </Show>
              <Main display={display()}>{props.children}</Main>
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

function DisplayPage() {
  return <TasksPage display />;
}

export function App() {
  return (
    <NotificationsProvider>
      <SessionProvider
        syncTimezone={!isDisplayPath()}
        exchangeHashToken
      >
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
            <Route
              path={DISPLAY_PATH}
              component={DisplayPage}
            />
          </Route>
        </Router>
      </SessionProvider>
    </NotificationsProvider>
  );
}
