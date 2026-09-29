import type { ChecklistItem } from '@karotto/core';
import GripVertical from 'lucide-solid/icons/grip-vertical';
import Plus from 'lucide-solid/icons/plus';
import Trash from 'lucide-solid/icons/trash';
import {
  createSignal,
  For,
  Show,
} from 'solid-js';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DisclosureChevron } from '@/components/ui/Disclosure';
import { Row } from '@/components/ui/Layout';
import { newId } from '@/lib/ids';
import {
  createSortable,
  moveItem,
} from '@/lib/sortable';
import { twc } from '@/styles/twc';

const ListBody = twc(
  'div',
  ['mt-1'],
);

const ItemRow = twc(
  Row,
  [
    'group/row',
    'relative',
    'h-8',
    'border-b',
    'border-neutral-500',
  ],
  {
    variants: {
      first: {
        true: ['border-t'],
        false: [],
      },
    },
    defaultVariants: { first: 'false' },
  },
);

const GripHandle = twc(
  'span',
  [
    'grippy',
    'absolute',
    '-left-4',
    'top-1',
    'cursor-grab',
    'text-neutral-200',
    'opacity-0',
    'group-hover/row:opacity-100',
  ],
);

const CheckboxSlot = twc(
  'span',
  ['ml-[6px]'],
);

const ItemInput = twc(
  'input',
  [
    'ml-3',
    'h-6',
    'flex-1',
    'border-0',
    'bg-transparent',
    'p-0',
    'text-[14px]',
    'leading-[1.71]',
    'text-neutral-50',
    'placeholder:text-neutral-200',
    'focus:outline-none',
  ],
);

const RevealOnRowHover = twc(
  'span',
  [
    'px-2',
    'opacity-0',
    'group-hover/row:opacity-100',
    'focus-within:opacity-100',
  ],
);

const NewItemRow = twc(
  Row,
  ['h-8'],
  {
    variants: {
      topBorder: {
        true: [
          'border-t',
          'border-neutral-500',
        ],
        false: [],
      },
    },
    defaultVariants: { topBorder: 'false' },
  },
);

const PlusIcon = twc(
  Plus,
  [
    'ml-[11px]',
    'text-neutral-200',
  ],
);

type ChecklistEditorProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  pendingText: string;
  onPendingChange: (text: string) => void;
};

export function ChecklistEditor(props: ChecklistEditorProps) {
  const [
    open,
    setOpen,
  ] = createSignal(true);
  let list: HTMLDivElement | undefined;

  const update = (
    id: string,
    patch: Partial<ChecklistItem>,
  ) => {
    props.onChange(props.items.map((item) => (item.id === id
      ? {
          ...item,
          ...patch,
        }
      : item)));
  };

  const remove = (id: string) => props.onChange(props.items.filter((item) => item.id !== id));

  const addPending = () => {
    const text = props.pendingText.trim();
    if (text === '') {
      return;
    }
    props.onChange([
      ...props.items,
      {
        id: newId(),
        text,
        completed: false,
      },
    ]);
    props.onPendingChange('');
  };

  createSortable(
    () => (open() ? list : undefined),
    () => ({
      handle: '.grippy',
      onReorder: (
        from,
        to,
      ) => props.onChange(moveItem(
        props.items,
        from,
        to,
      )),
    }),
  );

  return (
    <div>
      <Button
        layout="disclosure"
        aria-expanded={open()}
        iconRight={(
          <DisclosureChevron
            size={16}
            flipped={open()}
          />
        )}
        onClick={() => setOpen((value) => !value)}
      >
        Checklist
      </Button>
      <Show when={open()}>
        <ListBody>
          <div ref={(element: HTMLDivElement) => {
            list = element;
          }}
          >
            <For each={props.items}>
              {(
                item,
                index,
              ) => (
                <ItemRow first={index() === 0}>
                  <GripHandle>
                    <GripVertical size={16} />
                  </GripHandle>
                  <CheckboxSlot>
                    <Checkbox
                      checked={item.completed}
                      onChange={(checked) => update(
                        item.id,
                        { completed: checked },
                      )}
                    />
                  </CheckboxSlot>
                  <ItemInput
                    value={item.text}
                    aria-label="Checklist item"
                    onInput={(event) => update(
                      item.id,
                      { text: event.currentTarget.value },
                    )}
                  />
                  <RevealOnRowHover>
                    <Button
                      layout="icon-danger"
                      aria-label="Remove checklist item"
                      icon={<Trash size={14} />}
                      onClick={() => remove(item.id)}
                    />
                  </RevealOnRowHover>
                </ItemRow>
              )}
            </For>
          </div>
          <NewItemRow topBorder={props.items.length === 0}>
            <PlusIcon
              size={10}
              stroke-width={3}
            />
            <ItemInput
              placeholder="New checklist item"
              value={props.pendingText}
              onInput={(event) => props.onPendingChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addPending();
                }
              }}
              onBlur={addPending}
            />
          </NewItemRow>
        </ListBody>
      </Show>
    </div>
  );
}
