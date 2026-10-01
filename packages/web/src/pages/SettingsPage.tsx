import {
  dateFormatSchema,
  resolveTheme,
  themeModes,
  themes,
} from '@karotto/core';
import type {
  ApiToken,
  DateFormat,
} from '@karotto/core';
import {
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { userApi } from '@/api';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Input,
  Label,
  Select,
} from '@/components/ui/Input';
import {
  Card,
  Row,
  Spacer,
  Stack,
} from '@/components/ui/Layout';
import {
  Heading,
  Text,
} from '@/components/ui/Typography';
import { browserTimezone } from '@/lib/dates';
import {
  CodeChip,
  MediumSlot,
  NarrowSlot,
  Page,
  Swatch,
  SwatchRow,
  ThemeGrid,
  ThemeModes,
  ThemeName,
  TokenCell,
  TokenHeadCell,
  TokenHeadRow,
  TokenReveal,
  TokenRow,
  TokenTable,
  TokenValue,
} from '@/pages/SettingsPage.styles';
import { useNotifications } from '@/stores/notifications';
import { useSession } from '@/stores/session';
import {
  canSwitchMode,
  modePreference,
  preferredMode,
  setModePreference,
  setThemeId,
  themeId,
} from '@/stores/theme';
import type { ModePreference } from '@/stores/theme';

const dayStartLabel = (hour: number) => {
  if (hour === 0) {
    return 'Default (12:00 AM)';
  }
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `+${hour} hours (${display}:00 ${suffix})`;
};

const hours = Array.from(
  { length: 24 },
  (
    _,
    hour,
  ) => hour,
);

const dateFormats = dateFormatSchema.options;

const swatchKeys = [
  'brand-300',
  'page',
  'surface',
  'red-100',
  'yellow-100',
  'green-100',
  'blue-100',
];

export function SettingsPage() {
  const session = useSession();
  const notifications = useNotifications();
  const prefs = () => session.user()?.preferences;

  const [
    tokens,
    setTokens,
  ] = createSignal<ApiToken[]>([]);
  const [
    tokenName,
    setTokenName,
  ] = createSignal('');
  const [
    newToken,
    setNewToken,
  ] = createSignal<string | null>(null);
  const [
    currentPassword,
    setCurrentPassword,
  ] = createSignal('');
  const [
    newPassword,
    setNewPassword,
  ] = createSignal('');
  const [
    retention,
    setRetention,
  ] = createSignal<string>('');

  onMount(() => {
    userApi.tokens().then(setTokens).catch(notifications.error);
    setRetention(String(prefs()?.completedTodoRetentionDays ?? ''));
  });

  const update = (patch: Parameters<typeof session.updatePreferences>[0]) => {
    session.updatePreferences(patch).then(() => notifications.notify(
      'success',
      'Saved',
    )).catch(notifications.error);
  };

  const createToken = async () => {
    try {
      const created = await userApi.createToken(tokenName().trim() || 'token');
      setNewToken(created.token);
      setTokenName('');
      setTokens(await userApi.tokens());
    } catch (error) {
      notifications.error(error);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this token? Scripts using it will stop working.')) {
      return;
    }
    try {
      await userApi.revokeToken(id);
      setTokens(await userApi.tokens());
    } catch (error) {
      notifications.error(error);
    }
  };

  const changePassword = async () => {
    try {
      await userApi.changePassword(
        currentPassword(),
        newPassword(),
      );
      setCurrentPassword('');
      setNewPassword('');
      notifications.notify(
        'success',
        'Password updated',
      );
    } catch (error) {
      notifications.error(error);
    }
  };

  return (
    <Page>
      <Heading level="page">Settings</Heading>

      <Card>
        <Heading level="section">Appearance</Heading>
        <Spacer top="md">
          <Text tone="help">Theme and colour mode are saved in this browser only.</Text>
        </Spacer>
        <Spacer top="md">
          <ThemeGrid>
            <For each={themes}>
              {(spec) => {
                const preview = () => resolveTheme(
                  spec,
                  preferredMode(),
                ).tokens;
                const modes = themeModes(spec);
                return (
                  <Button
                    layout="theme-card"
                    active={themeId() === spec.id}
                    aria-pressed={themeId() === spec.id}
                    onClick={() => setThemeId(spec.id)}
                  >
                    <SwatchRow>
                      <For each={swatchKeys}>
                        {(key) => <Swatch style={{ 'background-color': preview()[key] }} />}
                      </For>
                    </SwatchRow>
                    <ThemeName>{spec.name}</ThemeName>
                    <ThemeModes>{modes.length === 2 ? 'Light and dark' : modes[0] === 'dark' ? 'Dark only' : 'Light only'}</ThemeModes>
                  </Button>
                );
              }}
            </For>
          </ThemeGrid>
        </Spacer>
        <Spacer top="md">
          <Label for="setting-mode">Colour mode</Label>
          <NarrowSlot>
            <Select
              id="setting-mode"
              value={modePreference()}
              disabled={!canSwitchMode()}
              onChange={(event) => setModePreference(event.currentTarget.value as ModePreference)}
            >
              <option value="system">Follow system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </NarrowSlot>
        </Spacer>
      </Card>

      <Card>
        <Heading level="section">Day Start Adjustment</Heading>
        <Spacer top="md">
          <Text tone="help">
            karotto checks and resets your Dailies at midnight in your own time zone each day. You can adjust when that happens past the default time here. Changing it counts as a completed rollover for today.
          </Text>
        </Spacer>
        <Spacer top="md">
          <Label for="setting-day-start">Day starts at</Label>
          <NarrowSlot>
            <Select
              id="setting-day-start"
              value={String(prefs()?.dayStart ?? 0)}
              onChange={(event) => update({
                dayStart: Number.parseInt(
                  event.currentTarget.value,
                  10,
                ),
              })}
            >
              <For each={hours}>{(hour) => <option value={String(hour)}>{dayStartLabel(hour)}</option>}</For>
            </Select>
          </NarrowSlot>
        </Spacer>
        <Spacer top="md">
          <Text tone="help">
            Time zone:
            {' '}
            <strong>{prefs()?.timezone}</strong>
            <Show when={prefs()?.timezone !== browserTimezone()}>
              <span>{` (your browser reports ${browserTimezone()}) `}</span>
              <Button
                layout="link"
                size="sm"
                onClick={() => update({ timezone: browserTimezone() })}
              >
                Use browser time zone
              </Button>
            </Show>
          </Text>
        </Spacer>
      </Card>

      <Card>
        <Heading level="section">Vacation</Heading>
        <Spacer top="md">
          <Text tone="help">
            While paused, days still roll over as usual, but missed Dailies keep their streak and value and To Do's do not decay. Dailies you tick still count.
          </Text>
        </Spacer>
        <Spacer top="md">
          <Checkbox
            checked={prefs()?.paused ?? false}
            label="Pause"
            onChange={(checked) => update({ paused: checked })}
          />
        </Spacer>
      </Card>

      <Card>
        <Heading level="section">Date Format</Heading>
        <Spacer top="md">
          <Label for="setting-date-format">Date format</Label>
          <NarrowSlot>
            <Select
              id="setting-date-format"
              value={session.dateFormat()}
              onChange={(event) => update({ dateFormat: event.currentTarget.value as DateFormat })}
            >
              <For each={dateFormats}>{(format) => <option value={format}>{format}</option>}</For>
            </Select>
          </NarrowSlot>
        </Spacer>
      </Card>

      <Card>
        <Heading level="section">Completed To Do's</Heading>
        <Spacer top="md">
          <Text tone="help">Completed To Do's are deleted after this many days at day rollover. Leave empty to keep them forever.</Text>
        </Spacer>
        <Spacer top="md">
          <MediumSlot>
            <Row gap="sm">
              <Input
                size="sm"
                type="number"
                min={1}
                max={3650}
                aria-label="Retention days"
                value={retention()}
                onInput={(event) => setRetention(event.currentTarget.value)}
              />
              <Button
                layout="secondary"
                onClick={() => {
                  const value = retention().trim();
                  update({
                    completedTodoRetentionDays: value === ''
                      ? null
                      : Number.parseInt(
                          value,
                          10,
                        ),
                  });
                }}
              >
                Save
              </Button>
            </Row>
          </MediumSlot>
        </Spacer>
      </Card>

      <Card>
        <Heading level="section">API Tokens</Heading>
        <Spacer top="md">
          <Text tone="help">
            Long-lived tokens for scripts. Send them as
            {' '}
            <CodeChip>Authorization: Bearer krt_…</CodeChip>
            . Interactive documentation lives at
            {' '}
            <a href="/api/v1/docs">/api/v1/docs</a>
            {' '}
            (OpenAPI at
            {' '}
            <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>
            ).
          </Text>
        </Spacer>
        <Spacer top="md">
          <MediumSlot>
            <Row gap="sm">
              <Input
                size="sm"
                placeholder="Token name"
                aria-label="Token name"
                value={tokenName()}
                onInput={(event) => setTokenName(event.currentTarget.value)}
              />
              <Button onClick={() => void createToken()}>Create</Button>
            </Row>
          </MediumSlot>
        </Spacer>
        <Show when={newToken()}>
          {(token) => (
            <TokenReveal>
              <Text tone="bold">Copy this token now. It will not be shown again.</Text>
              <TokenValue>{token()}</TokenValue>
            </TokenReveal>
          )}
        </Show>
        <TokenTable>
          <thead>
            <TokenHeadRow>
              <TokenHeadCell>Name</TokenHeadCell>
              <TokenHeadCell>Prefix</TokenHeadCell>
              <TokenHeadCell>Last used</TokenHeadCell>
              <TokenHeadCell />
            </TokenHeadRow>
          </thead>
          <tbody>
            <For each={tokens()}>
              {(token) => (
                <TokenRow>
                  <TokenCell>{token.name}</TokenCell>
                  <TokenCell look="mono">{`${token.prefix}…`}</TokenCell>
                  <TokenCell look="muted">{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'never'}</TokenCell>
                  <TokenCell look="actions">
                    <Button
                      layout="link-danger"
                      size="sm"
                      onClick={() => void revoke(token.id)}
                    >
                      Revoke
                    </Button>
                  </TokenCell>
                </TokenRow>
              )}
            </For>
            <Show when={tokens().length === 0}>
              <tr>
                <TokenCell
                  look="empty"
                  colSpan={4}
                >
                  No tokens yet.
                </TokenCell>
              </tr>
            </Show>
          </tbody>
        </TokenTable>
      </Card>

      <Card>
        <Heading level="section">Password</Heading>
        <Spacer top="md">
          <MediumSlot>
            <Stack gap="md">
              <div>
                <Label for="setting-current-password">Current password</Label>
                <Input
                  id="setting-current-password"
                  size="sm"
                  type="password"
                  autocomplete="current-password"
                  value={currentPassword()}
                  onInput={(event) => setCurrentPassword(event.currentTarget.value)}
                />
              </div>
              <div>
                <Label for="setting-new-password">New password</Label>
                <Input
                  id="setting-new-password"
                  size="sm"
                  type="password"
                  autocomplete="new-password"
                  value={newPassword()}
                  onInput={(event) => setNewPassword(event.currentTarget.value)}
                />
              </div>
              <div>
                <Button
                  layout="secondary"
                  disabled={currentPassword() === '' || newPassword().length < 8}
                  onClick={() => void changePassword()}
                >
                  Change password
                </Button>
              </div>
            </Stack>
          </MediumSlot>
        </Spacer>
      </Card>
    </Page>
  );
}
