import type { JSX } from 'solid-js';
import {
  createSignal,
  Show,
} from 'solid-js';
import { FloatingPanel } from '@/components/ui/Layout';
import { createDismissable } from '@/lib/dismiss';
import { twc } from '@/styles/twc';

const MenuRoot = twc(
  'div',
  ['relative'],
);

const Trigger = twc(
  'div',
  [],
  {
    variants: {
      reveal: {
        hover: [
          'opacity-0',
          'transition-opacity',
          'duration-150',
          'group-hover:opacity-100',
          'focus-within:opacity-100',
        ],
        always: [],
      },
      expanded: {
        true: ['opacity-100'],
        false: [],
      },
    },
    defaultVariants: {
      reveal: 'always',
      expanded: 'false',
    },
  },
);

const MenuList = twc(
  'div',
  [],
  {
    variants: {
      spacing: {
        tight: [],
        padded: ['py-1'],
      },
    },
    defaultVariants: { spacing: 'tight' },
  },
);

type MenuProps = {
  trigger: (open: boolean) => JSX.Element;
  children: (close: () => void) => JSX.Element;
  reveal?: 'hover' | 'always';
  spacing?: 'tight' | 'padded';
};

export function Menu(props: MenuProps) {
  const [
    open,
    setOpen,
  ] = createSignal(false);
  let root: HTMLDivElement | undefined;

  createDismissable({
    root: () => root,
    active: open,
    onDismiss: () => setOpen(false),
  });

  const close = () => setOpen(false);

  return (
    <MenuRoot ref={(element: HTMLDivElement) => {
      root = element;
    }}
    >
      <Trigger
        reveal={props.reveal ?? 'always'}
        expanded={open()}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {props.trigger(open())}
      </Trigger>
      <Show when={open()}>
        <FloatingPanel
          role="menu"
          anchor="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <MenuList spacing={props.spacing ?? 'tight'}>{props.children(close)}</MenuList>
        </FloatingPanel>
      </Show>
    </MenuRoot>
  );
}
