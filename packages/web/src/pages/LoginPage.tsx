import { useNavigate } from '@solidjs/router';
import Eye from 'lucide-solid/icons/eye';
import EyeOff from 'lucide-solid/icons/eye-off';
import {
  createSignal,
  Show,
} from 'solid-js';
import logo from '@/assets/logo.svg';
import { Button } from '@/components/ui/Button';
import {
  FieldGroup,
  Input,
  InputGroup,
  InputGroupField,
  Label,
} from '@/components/ui/Input';
import {
  Spacer,
  Stack,
} from '@/components/ui/Layout';
import {
  Heading,
  Text,
} from '@/components/ui/Typography';
import { useSession } from '@/stores/session';
import { twc } from '@/styles/twc';

const LoginScreen = twc(
  'div',
  [
    'flex',
    'min-h-screen',
    'items-center',
    'justify-center',
    'bg-purple-100',
    'px-3',
  ],
);

const LoginCard = twc(
  'form',
  [
    'w-full',
    'max-w-[400px]',
    'rounded-md',
    'bg-white',
    'p-8',
    'shadow-modal',
  ],
);

const BrandBlock = twc(
  Stack,
  ['mb-6'],
);

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [
    username,
    setUsername,
  ] = createSignal('');
  const [
    password,
    setPassword,
  ] = createSignal('');
  const [
    revealPassword,
    setRevealPassword,
  ] = createSignal(false);
  const [
    error,
    setError,
  ] = createSignal<string | null>(null);
  const [
    busy,
    setBusy,
  ] = createSignal(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await session.login(
        username(),
        password(),
      );
      navigate(
        '/',
        { replace: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginScreen>
      <LoginCard onSubmit={(event) => void submit(event)}>
        <BrandBlock align="center">
          <img
            src={logo}
            alt=""
            width={64}
            height={64}
          />
          <Spacer top="sm">
            <Heading level="brand">karotto</Heading>
          </Spacer>
        </BrandBlock>
        <div>
          <Label for="login-username">Username</Label>
          <Input
            id="login-username"
            size="sm"
            autocomplete="username"
            value={username()}
            onInput={(event) => setUsername(event.currentTarget.value)}
          />
        </div>
        <FieldGroup>
          <Label for="login-password">Password</Label>
          <InputGroup>
            <InputGroupField
              id="login-password"
              type={revealPassword() ? 'text' : 'password'}
              autocomplete="current-password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
            <Button
              layout="icon"
              size="sm"
              aria-label={revealPassword() ? 'Hide password' : 'Show password'}
              aria-pressed={revealPassword()}
              onClick={() => setRevealPassword((shown) => !shown)}
              icon={revealPassword() ? <EyeOff size={16} /> : <Eye size={16} />}
            />
          </InputGroup>
        </FieldGroup>
        <Show when={error()}>
          <Spacer top="md">
            <Text tone="error">{error()}</Text>
          </Spacer>
        </Show>
        <Spacer top="xl">
          <Button
            type="submit"
            block
            disabled={busy() || username() === '' || password() === ''}
          >
            Log in
          </Button>
        </Spacer>
      </LoginCard>
    </LoginScreen>
  );
}
