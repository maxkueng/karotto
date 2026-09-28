import {
  createEffect,
  onCleanup,
} from 'solid-js';
import Sortable from 'sortablejs';

type SortableOptions = Omit<Sortable.Options, 'onEnd'> & {
  onReorder: (
    from: number,
    to: number,
  ) => void;
};

export function moveItem<T>(
  list: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...list];
  const [moved] = next.splice(
    from,
    1,
  );
  if (moved !== undefined) {
    next.splice(
      to,
      0,
      moved,
    );
  }
  return next;
}

function restoreDomOrder(
  item: HTMLElement,
  oldIndex: number,
): void {
  const parent = item.parentElement;
  if (!parent) {
    return;
  }
  parent.removeChild(item);
  parent.insertBefore(
    item,
    parent.children[oldIndex] ?? null,
  );
}

export function createSortable(
  element: () => HTMLElement | undefined,
  options: () => SortableOptions,
): void {
  let instance: Sortable | undefined;
  createEffect(() => {
    const list = element();
    const {
      onReorder,
      ...rest
    } = options();
    instance?.destroy();
    if (!list) {
      return;
    }
    instance = Sortable.create(
      list,
      {
        animation: 0,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: 'drag-preview',
        ...rest,
        onEnd: (event) => {
          const {
            item,
            oldIndex,
            newIndex,
          } = event;
          if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
            return;
          }
          restoreDomOrder(
            item,
            oldIndex,
          );
          onReorder(
            oldIndex,
            newIndex,
          );
        },
      },
    );
  });
  onCleanup(() => instance?.destroy());
}
