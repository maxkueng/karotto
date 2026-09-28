import X from 'lucide-solid/icons/x';
import {
  For,
  Show,
} from 'solid-js';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/stores/notifications';
import { twc } from '@/styles/twc';

const SnackbarStack = twc(
  'div',
  [
    'pointer-events-none',
    'fixed',
    'bottom-4',
    'left-1/2',
    '-translate-x-1/2',
    'z-[999]',
    'flex',
    'w-[350px]',
    'max-w-[calc(100%-20px)]',
    'flex-col-reverse',
    'items-center',
  ],
);

const Snackbar = twc(
  'div',
  [
    'pointer-events-auto',
    'relative',
    'mt-2',
    'w-full',
    'cursor-pointer',
    'rounded-sm',
    'px-4',
    'py-3',
    'pr-8',
    'text-white',
    'shadow-card',
    'fade-in',
  ],
  {
    variants: {
      tone: {
        error: ['bg-maroon-100'],
        success: ['bg-green-50'],
        info: ['bg-blue-50'],
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

const SnackbarTitle = twc(
  'div',
  [
    'text-[12px]',
    'font-bold',
    'uppercase',
    'tracking-wide',
    'opacity-80',
  ],
);

const SnackbarText = twc(
  'div',
  [
    'text-[14px]',
    'leading-[1.43]',
  ],
);

const SnackbarAction = twc(
  'div',
  [
    'mt-2',
    'flex',
    'justify-end',
  ],
);

const SnackbarClose = twc(
  X,
  [
    'absolute',
    'right-2',
    'top-2',
    'opacity-50',
  ],
);

export function Snackbars() {
  const notifications = useNotifications();
  return (
    <SnackbarStack>
      <For each={notifications.items()}>
        {(item) => (
          <Snackbar
            tone={item.type}
            onClick={() => notifications.dismiss(item.id)}
          >
            <SnackbarTitle>karotto</SnackbarTitle>
            <SnackbarText>{item.text}</SnackbarText>
            <Show when={item.action}>
              {(action) => (
                <SnackbarAction>
                  <Button
                    layout="snackbar-action"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      action().run();
                    }}
                  >
                    {action().label}
                  </Button>
                </SnackbarAction>
              )}
            </Show>
            <SnackbarClose size={12} />
          </Snackbar>
        )}
      </For>
    </SnackbarStack>
  );
}
