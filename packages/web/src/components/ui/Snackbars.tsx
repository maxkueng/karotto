import X from 'lucide-solid/icons/x';
import { For } from 'solid-js';
import { useNotifications } from '@/stores/notifications';
import { twc } from '@/styles/twc';

const SnackbarStack = twc(
  'div',
  [
    'pointer-events-none',
    'fixed',
    'right-[10px]',
    'top-[66px]',
    'z-[999]',
    'flex',
    'w-[350px]',
    'max-w-[calc(100%-20px)]',
    'flex-col',
    'items-end',
  ],
);

const Snackbar = twc(
  'div',
  [
    'pointer-events-auto',
    'relative',
    'mb-2',
    'max-w-[330px]',
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
            <SnackbarClose size={12} />
          </Snackbar>
        )}
      </For>
    </SnackbarStack>
  );
}
