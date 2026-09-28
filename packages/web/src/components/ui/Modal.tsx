import type { JSX } from 'solid-js';
import {
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { twc } from '@/styles/twc';

const Backdrop = twc(
  'div',
  [
    'fixed',
    'inset-0',
    'z-[1350]',
    'overflow-y-auto',
    'bg-purple-100/90',
    'fade-in',
  ],
);

const Dialog = twc(
  'div',
  [
    'mx-auto',
    'my-12',
    'w-[calc(100%-24px)]',
    'rounded-md',
    'bg-white',
    'shadow-modal',
  ],
);

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  width?: number;
  children: JSX.Element;
  label: string;
};

export function Modal(props: ModalProps) {
  const requestClose = () => {
    props.onClose?.();
  };

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && props.open && props.closeOnEscape !== false) {
        requestClose();
      }
    };
    document.addEventListener(
      'keydown',
      onKey,
    );
    onCleanup(() => document.removeEventListener(
      'keydown',
      onKey,
    ));
  });

  return (
    <Show when={props.open}>
      <Portal>
        <Backdrop onClick={(event) => {
          if (event.target === event.currentTarget && props.closeOnBackdrop !== false) {
            requestClose();
          }
        }}
        >
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-label={props.label}
            style={{ 'max-width': `${props.width ?? 448}px` }}
          >
            {props.children}
          </Dialog>
        </Backdrop>
      </Portal>
    </Show>
  );
}
