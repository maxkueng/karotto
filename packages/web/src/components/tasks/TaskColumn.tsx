import {
  hasAllTags,
  matchesFilter,
  matchesSearch,
} from '@karotto/core';
import type {
  ActiveFilter,
  Task,
  TaskType,
} from '@karotto/core';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from 'solid-js';
import { TaskCard } from '@/components/tasks/TaskCard';
import {
  ClearCompletedBox,
  ColumnHeader,
  ColumnSection,
  EmptyState,
  EmptyStateIcon,
  FilterTabs,
  QuickAddInput,
  QuickAddTip,
  SortableList,
  TaskList,
} from '@/components/tasks/TaskColumn.styles';
import { taskTypes } from '@/components/tasks/taskTypes';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spacer } from '@/components/ui/Layout';
import {
  Heading,
  Text,
} from '@/components/ui/Typography';
import { createSortable } from '@/lib/sortable';
import { useNotifications } from '@/stores/notifications';
import { useSession } from '@/stores/session';
import { useTasks } from '@/stores/tasks';
import {
  activeFilter,
  searchQuery,
  selectedTagIds,
  setActiveFilter,
} from '@/stores/ui';

type FilterOption<T extends TaskType> = {
  value: ActiveFilter[T];
  label: string;
};

const filterOptions: { [T in TaskType]: FilterOption<T>[] } = {
  habit: [
    {
      value: 'all',
      label: 'All',
    },
    {
      value: 'weak',
      label: 'Weak',
    },
    {
      value: 'strong',
      label: 'Strong',
    },
  ],
  daily: [
    {
      value: 'all',
      label: 'All',
    },
    {
      value: 'due',
      label: 'Due',
    },
    {
      value: 'notDue',
      label: 'Not Due',
    },
  ],
  todo: [
    {
      value: 'active',
      label: 'Active',
    },
    {
      value: 'scheduled',
      label: 'Scheduled',
    },
    {
      value: 'complete',
      label: 'Complete',
    },
  ],
};

type TaskColumnProps = {
  type: TaskType;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

const UNDO_MS = 6000;

export function TaskColumn(props: TaskColumnProps) {
  const session = useSession();
  const tasks = useTasks();
  const notifications = useNotifications();

  const meta = () => taskTypes[props.type];
  const filter = createMemo<ActiveFilter[TaskType]>(() => activeFilter()[props.type]);
  const isCompleteFilter = () => props.type === 'todo' && filter() === 'complete';
  const isScheduledFilter = () => props.type === 'todo' && filter() === 'scheduled';

  const [
    quickAdd,
    setQuickAdd,
  ] = createSignal('');
  const [
    quickAddFocused,
    setQuickAddFocused,
  ] = createSignal(false);
  const [
    submitting,
    setSubmitting,
  ] = createSignal(false);

  createEffect(() => {
    if (isCompleteFilter() && !tasks.state.completedLoaded) {
      tasks.loadCompleted().catch(notifications.error);
    }
  });

  const source = createMemo<Task[]>(() => {
    if (isCompleteFilter()) {
      return tasks.completedTodos();
    }
    switch (props.type) {
      case 'habit':
        return tasks.habits();
      case 'daily':
        return tasks.dailies();
      case 'todo':
        return tasks.todos();
    }
  });

  const visible = createMemo(() => {
    const query = searchQuery();
    const tagIds = selectedTagIds();
    const active = filter();
    const list = source().filter((task) => matchesFilter(
      task,
      active,
    ) && hasAllTags(
      task,
      tagIds,
    ) && matchesSearch(
      task,
      query,
    ));
    if (!isScheduledFilter()) {
      return list;
    }
    return [...list].sort((
      a,
      b,
    ) => {
      const da = a.type === 'todo' ? a.dueDate ?? '' : '';
      const db = b.type === 'todo' ? b.dueDate ?? '' : '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  });

  const setFilter = (value: ActiveFilter[TaskType]) => {
    setActiveFilter(
      props.type,
      value,
    );
  };

  const submitQuickAdd = async () => {
    const lines = quickAdd().split('\n').map((line) => line.trim()).filter((line) => line !== '').reverse();
    if (lines.length === 0 || submitting()) {
      return;
    }
    setSubmitting(true);
    try {
      await tasks.create(lines.map((text) => ({
        type: props.type,
        text,
        tags: selectedTagIds(),
      })));
      setQuickAdd('');
    } catch (error) {
      notifications.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const score = (
    task: Task,
    direction: 'up' | 'down',
  ) => {
    tasks.score(
      task.id,
      direction,
    ).then(() => {
      if (task.type === 'habit' || direction !== 'up') {
        return;
      }
      notifications.notify(
        'success',
        `Completed “${task.text}”`,
        {
          durationMs: UNDO_MS,
          action: {
            label: 'Undo',
            run: () => tasks.score(
              task.id,
              'down',
            ).catch(notifications.error),
          },
        },
      );
    }).catch(notifications.error);
  };

  const moveTo = (
    task: Task,
    position: number,
  ) => {
    tasks.move(
      task.id,
      position,
    ).catch(notifications.error);
  };

  let listRef: HTMLDivElement | undefined;

  createSortable(
    () => listRef,
    () => ({
      delay: 100,
      delayOnTouchOnly: true,
      scrollSensitivity: 64,
      ghostClass: 'task-drag-ghost',
      disabled: isCompleteFilter() || isScheduledFilter(),
      filter: 'button, input, a',
      preventOnFilter: false,
      onStart: () => document.documentElement.classList.add('cursor-grabbing'),
      onReorder: (
        from,
        to,
      ) => {
        document.documentElement.classList.remove('cursor-grabbing');
        const list = visible();
        const moved = list[from];
        const target = list[to];
        if (!moved || !target) {
          return;
        }
        moveTo(
          moved,
          source().findIndex((task) => task.id === target.id),
        );
      },
    }),
  );

  return (
    <ColumnSection aria-label={meta().plural}>
      <ColumnHeader>
        <Heading level="column">{meta().plural}</Heading>
        <Show when={visible().length > 0}>
          <Badge tone="count">{visible().length}</Badge>
        </Show>
        <FilterTabs justify="end">
          <For each={filterOptions[props.type]}>
            {(option) => (
              <Button
                layout="tab"
                active={filter() === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            )}
          </For>
        </FilterTabs>
      </ColumnHeader>

      <TaskList>
        <Show when={!isCompleteFilter()}>
          <QuickAddInput
            focused={quickAddFocused()}
            rows={quickAddFocused()
              ? Math.max(
                  1,
                  quickAdd().split('\n').length,
                )
              : 1}
            placeholder={meta().placeholder}
            value={quickAdd()}
            onInput={(event) => setQuickAdd(event.currentTarget.value)}
            onFocus={() => setQuickAddFocused(true)}
            onBlur={() => setQuickAddFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const target = event.currentTarget;
                void submitQuickAdd().then(() => target.blur());
              }
            }}
          />
          <Show when={quickAddFocused()}>
            <QuickAddTip>
              {`Tip: To add multiple ${meta().plural}, separate each one using a line break (Shift + Enter) and then press "Enter."`}
            </QuickAddTip>
          </Show>
        </Show>

        <Show when={isCompleteFilter() && visible().length > 0}>
          <ClearCompletedBox>
            <Text tone="muted">
              {`Completed To Do's are deleted after ${session.user()?.preferences.completedTodoRetentionDays ?? 'a number of'} days.`}
            </Text>
            <Spacer top="sm">
              <Button
                layout="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete your completed To Do\'s?')) {
                    tasks.clearCompleted().catch(notifications.error);
                  }
                }}
              >
                Delete Completed
              </Button>
            </Spacer>
          </ClearCompletedBox>
        </Show>

        <Show when={visible().length === 0}>
          <EmptyState>
            <EmptyStateIcon>{meta().icon(30)}</EmptyStateIcon>
            <Heading level="empty">{`These are your ${meta().plural}`}</Heading>
            <Text tone="faint">{meta().emptyText}</Text>
          </EmptyState>
        </Show>

        <SortableList ref={(element: HTMLDivElement) => {
          listRef = element;
        }}
        >
          <For each={visible()}>
            {(task) => (
              <TaskCard
                task={task}
                onScore={(direction) => score(
                  task,
                  direction,
                )}
                onEdit={() => props.onEdit(task)}
                onDelete={() => props.onDelete(task)}
                onMoveTop={() => moveTo(
                  task,
                  0,
                )}
                onMoveBottom={() => moveTo(
                  task,
                  -1,
                )}
                onToggleChecklistItem={(itemId) => tasks.toggleChecklistItem(
                  task.id,
                  itemId,
                ).catch(notifications.error)}
                onToggleCollapse={(collapsed) => tasks.setCollapsed(
                  task.id,
                  collapsed,
                ).catch(notifications.error)}
              />
            )}
          </For>
        </SortableList>
      </TaskList>
    </ColumnSection>
  );
}
