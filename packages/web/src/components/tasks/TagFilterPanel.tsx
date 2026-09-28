import type { Tag } from '@karotto/core';
import GripVertical from 'lucide-solid/icons/grip-vertical';
import Trash from 'lucide-solid/icons/trash';
import {
  createSignal,
  For,
  Show,
} from 'solid-js';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Row } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Typography';
import {
  createSortable,
  moveItem,
} from '@/lib/sortable';
import { useNotifications } from '@/stores/notifications';
import { useTags } from '@/stores/tags';
import {
  selectedTagIds,
  setSelectedTagIds,
  toggleSelectedTag,
} from '@/stores/ui';
import { twc } from '@/styles/twc';

const Panel = twc(
  'div',
  [
    'absolute',
    'left-0',
    'top-11',
    'z-[1200]',
    'w-full',
    'min-w-[300px]',
    'rounded-xs',
    'bg-white',
    'px-6',
    'text-[14px]',
    'leading-[1.43]',
    'shadow-card',
    'md:left-[20vw]',
    'md:max-w-[50vw]',
  ],
);

const Category = twc(
  'div',
  [
    'border-b',
    'border-gray-600',
    'py-6',
  ],
);

const TagGrid = twc(
  'div',
  [
    'mt-3',
    'grid',
    'grid-cols-2',
    'gap-x-3',
    'gap-y-2',
  ],
);

const EmptyHint = twc(
  Text,
  ['col-span-2'],
);

const EditList = twc(
  'div',
  ['mt-3'],
);

const EditRow = twc(
  Row,
  [
    'group/tag',
    'py-1',
  ],
);

const DragHandle = twc(
  'span',
  [
    'drag-handle',
    'cursor-grab',
    'text-gray-400',
    'hover:text-gray-200',
  ],
);

const TagNameInput = twc(
  'input',
  [
    'flex-1',
    'border-b',
    'border-gray-500',
    'bg-transparent',
    'py-1',
    'text-[14px]',
    'focus:border-purple-500',
    'focus:outline-none',
  ],
);

const NewTagInput = twc(
  'input',
  [
    'mt-2',
    'w-full',
    'border-b',
    'border-gray-500',
    'bg-transparent',
    'py-1',
    'pl-6',
    'text-[14px]',
    'placeholder:text-gray-200',
    'focus:border-purple-500',
    'focus:outline-none',
  ],
);

const RevealOnRowHover = twc(
  'span',
  [
    'opacity-0',
    'group-hover/tag:opacity-100',
    'focus-within:opacity-100',
  ],
);

const Footer = twc(
  Row,
  ['py-4'],
);

type TagFilterPanelProps = {
  onClose: () => void;
};

export function TagFilterPanel(props: TagFilterPanelProps) {
  const tags = useTags();
  const notifications = useNotifications();
  const [
    editing,
    setEditing,
  ] = createSignal(false);
  const [
    drafts,
    setDrafts,
  ] = createSignal<Tag[]>([]);
  const [
    newTag,
    setNewTag,
  ] = createSignal('');
  let list: HTMLDivElement | undefined;

  const startEditing = () => {
    setDrafts(tags.tags().map((tag) => ({ ...tag })));
    setEditing(true);
  };

  const saveEdits = async () => {
    try {
      const original = new Map(tags.tags().map((tag) => [
        tag.id,
        tag,
      ]));
      for (const draft of drafts()) {
        const before = original.get(draft.id);
        if (before && before.name !== draft.name && draft.name.trim() !== '') {
          await tags.rename(
            draft.id,
            draft.name.trim(),
          );
        }
      }
      const removed = tags.tags().filter((tag) => !drafts().some((draft) => draft.id === tag.id));
      for (const tag of removed) {
        await tags.remove(tag.id);
      }
      setSelectedTagIds((ids) => ids.filter((id) => !removed.some((tag) => tag.id === id)));
      if (newTag().trim() !== '') {
        await tags.create(newTag().trim());
        setNewTag('');
      }
      await tags.reorder(drafts().map((tag) => tag.id));
      setEditing(false);
    } catch (error) {
      notifications.error(error);
    }
  };

  createSortable(
    () => (editing() ? list : undefined),
    () => ({
      handle: '.drag-handle',
      onReorder: (
        from,
        to,
      ) => setDrafts((current) => moveItem(
        current,
        from,
        to,
      )),
    }),
  );

  return (
    <Panel onMouseLeave={() => {
      if (!editing()) {
        props.onClose();
      }
    }}
    >
      <Category>
        <Row justify="between">
          <strong>Tags</strong>
          <Show when={!editing()}>
            <Button
              layout="link"
              size="sm"
              onClick={startEditing}
            >
              Edit Tags
            </Button>
          </Show>
        </Row>
        <Show
          when={editing()}
          fallback={(
            <TagGrid>
              <For each={tags.tags()}>
                {(tag) => (
                  <Checkbox
                    checked={selectedTagIds().includes(tag.id)}
                    onChange={() => toggleSelectedTag(tag.id)}
                    label={tag.name}
                  />
                )}
              </For>
              <Show when={tags.tags().length === 0}>
                <EmptyHint tone="muted">No tags yet. Use Edit Tags to add some.</EmptyHint>
              </Show>
            </TagGrid>
          )}
        >
          <EditList ref={(element: HTMLDivElement) => {
            list = element;
          }}
          >
            <For each={drafts()}>
              {(tag) => (
                <EditRow gap="sm">
                  <DragHandle>
                    <GripVertical size={20} />
                  </DragHandle>
                  <TagNameInput
                    value={tag.name}
                    aria-label="Tag name"
                    onInput={(event) => {
                      const value = event.currentTarget.value;
                      setDrafts((current) => current.map((item) => (item.id === tag.id
                        ? {
                            ...item,
                            name: value,
                          }
                        : item)));
                    }}
                  />
                  <RevealOnRowHover>
                    <Button
                      layout="icon-danger"
                      aria-label={`Delete tag ${tag.name}`}
                      icon={<Trash size={14} />}
                      onClick={() => setDrafts((current) => current.filter((item) => item.id !== tag.id))}
                    />
                  </RevealOnRowHover>
                </EditRow>
              )}
            </For>
          </EditList>
          <NewTagInput
            placeholder="New Tag"
            value={newTag()}
            onInput={(event) => setNewTag(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void saveEdits();
              }
            }}
          />
        </Show>
      </Category>
      <Footer justify="between">
        <Show
          when={editing()}
          fallback={(
            <>
              <Button
                layout="link-red"
                onClick={() => setSelectedTagIds([])}
              >
                Clear all filters
              </Button>
              <Button
                layout="link-muted"
                onClick={props.onClose}
              >
                Cancel
              </Button>
            </>
          )}
        >
          <Button
            layout="link-blue"
            onClick={() => void saveEdits()}
          >
            Save Edits
          </Button>
          <Button
            layout="link-muted"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </Show>
      </Footer>
    </Panel>
  );
}
