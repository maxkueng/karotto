import {
  createEffect,
  onCleanup,
} from 'solid-js';
import type { Accessor } from 'solid-js';

type DismissableOptions = {
  root: () => HTMLElement | undefined;
  active: Accessor<boolean>;
  onDismiss: () => void;
};

export function createDismissable(options: DismissableOptions): void {
  const onPointerDown = (event: MouseEvent) => {
    const root = options.root();
    if (root && !root.contains(event.target as Node)) {
      options.onDismiss();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onDismiss();
    }
  };
  const detach = () => {
    document.removeEventListener(
      'mousedown',
      onPointerDown,
    );
    document.removeEventListener(
      'keydown',
      onKeyDown,
    );
  };
  createEffect(() => {
    if (!options.active()) {
      detach();
      return;
    }
    document.addEventListener(
      'mousedown',
      onPointerDown,
    );
    document.addEventListener(
      'keydown',
      onKeyDown,
    );
  });
  onCleanup(detach);
}
