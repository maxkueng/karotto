import type { Tag } from '@karotto/core';
import X from 'lucide-solid/icons/x';
import {
  createMemo,
  createSignal,
  For,
  Show,
} from 'solid-js';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Caret } from '@/components/ui/Caret';
import {
  FloatingPanel,
  Row,
} from '@/components/ui/Layout';
import { createDismissable } from '@/lib/dismiss';
import { useNotifications } from '@/stores/notifications';
import { useTags } from '@/stores/tags';
import { twc } from '@/styles/twc';

const SelectRoot = twc(
  'div',
  ['relative'],
);

const EmptyMessage = twc(
  'span',
  [
    'px-1',
    'text-neutral-200',
  ],
);

const PanelHeader = twc(
  Row,
  [
    'min-h-12',
    'bg-neutral-700',
    'px-3',
    'py-2',
  ],
);

const SearchInput = twc(
  'input',
  [
    'min-w-[120px]',
    'flex-1',
    'bg-transparent',
    'py-1',
    'text-[14px]',
    'focus:outline-none',
  ],
);

const OptionList = twc(
  'div',
  [
    'max-h-40',
    'overflow-y-auto',
  ],
);

type TagSelectProps = {
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function TagSelect(props: TagSelectProps) {
  const tags = useTags();
  const notifications = useNotifications();
  const [
    open,
    setOpen,
  ] = createSignal(false);
  const [
    query,
    setQuery,
  ] = createSignal('');
  let root: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;

  createDismissable({
    root: () => root,
    active: open,
    onDismiss: () => setOpen(false),
  });

  const toggle = () => {
    const next = !open();
    setOpen(next);
    if (next) {
      queueMicrotask(() => input?.focus());
    }
  };

  const selectedTags = createMemo(() => props.selected
    .map((id) => tags.byId(id))
    .filter((tag): tag is Tag => tag !== undefined));

  const available = createMemo(() => {
    const needle = query().trim().toLowerCase();
    return tags.tags().filter((tag) => !props.selected.includes(tag.id) && (needle === '' || tag.name.toLowerCase().includes(needle)));
  });

  const exactMatch = () => tags.tags().some((tag) => tag.name.toLowerCase() === query().trim().toLowerCase());

  const add = (id: string) => {
    props.onChange([
      ...props.selected,
      id,
    ]);
    setQuery('');
  };

  const remove = (id: string) => props.onChange(props.selected.filter((item) => item !== id));

  const createFromQuery = async () => {
    const name = query().trim();
    if (name === '') {
      return;
    }
    try {
      const tag = await tags.create(name);
      add(tag.id);
    } catch (error) {
      notifications.error(error);
    }
  };

  const pills = () => (
    <For each={selectedTags()}>
      {(tag) => (
        <Badge tone="tag">
          <span>{tag.name}</span>
          <Button
            layout="icon-danger"
            size="xs"
            aria-label={`Remove tag ${tag.name}`}
            icon={<X size={8} />}
            onClick={(event) => {
              event.stopPropagation();
              remove(tag.id);
            }}
          />
        </Badge>
      )}
    </For>
  );

  return (
    <SelectRoot ref={(element: HTMLDivElement) => {
      root = element;
    }}
    >
      <Button
        layout="field"
        aria-haspopup="listbox"
        aria-expanded={open()}
        iconRight={(
          <Caret
            tone="muted"
            placement="end"
          />
        )}
        onClick={toggle}
      >
        <Show
          when={selectedTags().length > 0}
          fallback={<EmptyMessage>Add tags...</EmptyMessage>}
        >
          {pills()}
        </Show>
      </Button>
      <Show when={open()}>
        <FloatingPanel>
          <PanelHeader
            gap="xs"
            wrap
          >
            {pills()}
            <SearchInput
              ref={(element: HTMLInputElement) => {
                input = element;
              }}
              placeholder="Enter a tag"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const first = available()[0];
                  if (first && (exactMatch() || query().trim() === '')) {
                    add(first.id);
                  } else {
                    void createFromQuery();
                  }
                } else if (event.key === 'Escape') {
                  toggle();
                }
              }}
            />
          </PanelHeader>
          <OptionList role="listbox">
            <For each={available()}>
              {(tag) => (
                <Button
                  layout="list"
                  size="sm"
                  role="option"
                  aria-selected={false}
                  onClick={() => add(tag.id)}
                >
                  {tag.name}
                </Button>
              )}
            </For>
            <Show when={query().trim() !== '' && !exactMatch()}>
              <Button
                layout="list"
                size="xs"
                onClick={() => void createFromQuery()}
              >
                {`Press Enter to add tag: "${query().trim()}"`}
              </Button>
            </Show>
          </OptionList>
        </FloatingPanel>
      </Show>
    </SelectRoot>
  );
}
