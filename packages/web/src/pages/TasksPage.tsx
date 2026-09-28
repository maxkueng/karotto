import { nextCdsBoundary } from '@karotto/core';
import type {
  Task,
  TaskCreateInput,
  TaskType,
} from '@karotto/core';
import SlidersHorizontal from 'lucide-solid/icons/sliders-horizontal';
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { cronApi } from '@/api';
import { CreateTaskMenu } from '@/components/tasks/CreateTaskMenu';
import { DeleteConfirmModal } from '@/components/tasks/DeleteConfirmModal';
import { TagFilterPanel } from '@/components/tasks/TagFilterPanel';
import { TaskColumn } from '@/components/tasks/TaskColumn';
import { TaskModal } from '@/components/tasks/TaskModal';
import type { TaskModalMode } from '@/components/tasks/TaskModal';
import { taskTypeOrder } from '@/components/tasks/taskTypes';
import { YesterdailiesModal } from '@/components/tasks/YesterdailiesModal';
import { Button } from '@/components/ui/Button';
import { Caret } from '@/components/ui/Caret';
import { Input } from '@/components/ui/Input';
import {
  ColumnGrid,
  CreateArea,
  CreateAreaMobile,
  Page,
  SearchArea,
  TagsButtonSlot,
  Toolbar,
} from '@/pages/TasksPage.styles';
import { useNotifications } from '@/stores/notifications';
import { useSession } from '@/stores/session';
import { useTags } from '@/stores/tags';
import { useTasks } from '@/stores/tasks';
import {
  isRunningYesterdailies,
  searchQuery,
  selectedTagIds,
  setRunningYesterdailies,
  setSearchQuery,
} from '@/stores/ui';

export function TasksPage() {
  const session = useSession();
  const tasks = useTasks();
  const tags = useTags();
  const notifications = useNotifications();

  const [
    modal,
    setModal,
  ] = createSignal<TaskModalMode | null>(null);
  const [
    deleting,
    setDeleting,
  ] = createSignal<Task | null>(null);
  const [
    filterOpen,
    setFilterOpen,
  ] = createSignal(false);
  const [
    yesterdailies,
    setYesterdailies,
  ] = createSignal<Task[] | null>(null);

  let cronTimer: number | undefined;

  const reloadAll = async () => {
    await Promise.all([
      session.refresh(),
      tasks.load(),
      tasks.state.completedLoaded ? tasks.loadCompleted() : Promise.resolve(),
    ]);
  };

  const scheduleNextCron = () => {
    window.clearTimeout(cronTimer);
    const next = nextCdsBoundary(
      new Date(),
      session.dayContext(),
    ).toMillis() + 10_000;
    const delay = Math.max(
      1000,
      Math.min(
        next - Date.now(),
        2_147_000_000,
      ),
    );
    cronTimer = window.setTimeout(
      () => void runCronFlow(),
      delay,
    );
  };

  const idle = () => {
    setRunningYesterdailies(false);
    scheduleNextCron();
  };

  const finishCron = async (completedIds: string[]) => {
    try {
      await cronApi.run(completedIds.map((id) => ({
        id,
        direction: 'up' as const,
      })));
      setYesterdailies(null);
      await reloadAll();
    } catch (error) {
      notifications.error(error);
    } finally {
      idle();
    }
  };

  const runCronFlow = async () => {
    if (isRunningYesterdailies()) {
      return;
    }
    setRunningYesterdailies(true);
    try {
      const status = await cronApi.status();
      if (!status.needsCron) {
        idle();
        return;
      }
      if (status.yesterdailies.length === 0) {
        await finishCron([]);
        return;
      }
      setYesterdailies(status.yesterdailies);
    } catch (error) {
      notifications.error(error);
      idle();
    }
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      session.refresh().then((user) => {
        if (user?.needsCron) {
          void runCronFlow();
        }
      }).catch(() => undefined);
    }
  };

  onMount(() => {
    Promise.all([
      tasks.load(),
      tags.load(),
    ])
      .then(() => {
        if (session.user()?.needsCron) {
          void runCronFlow();
        } else {
          scheduleNextCron();
        }
      })
      .catch(notifications.error);
    document.addEventListener(
      'visibilitychange',
      onVisible,
    );
  });

  onCleanup(() => {
    window.clearTimeout(cronTimer);
    document.removeEventListener(
      'visibilitychange',
      onVisible,
    );
  });

  createEffect(() => {
    session.dayContext();
    if (tasks.state.loaded && !isRunningYesterdailies()) {
      scheduleNextCron();
    }
  });

  const createOne = async (input: TaskCreateInput) => {
    await tasks.create([input]);
  };

  const saveOne = async (
    id: string,
    patch: Record<string, unknown>,
  ) => {
    await tasks.update(
      id,
      patch,
    );
  };

  const confirmDelete = (task: Task) => {
    setDeleting(null);
    setModal(null);
    tasks.remove(task.id).catch(notifications.error);
  };

  const openCreate = (type: TaskType) => setModal({
    kind: 'create',
    type,
    tags: selectedTagIds(),
  });

  return (
    <Page>
      <Toolbar
        gap="sm"
        justify="center"
        wrap
      >
        <SearchArea>
          <Input
            size="sm"
            type="search"
            aria-label="Search tasks"
            placeholder="Search"
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
          />
          <TagsButtonSlot>
            <Button
              layout="secondary"
              active={selectedTagIds().length > 0 || filterOpen()}
              aria-expanded={filterOpen()}
              icon={<SlidersHorizontal size={16} />}
              iconRight={<Caret />}
              onClick={() => setFilterOpen((open) => !open)}
            >
              Tags
            </Button>
          </TagsButtonSlot>
          <Show when={filterOpen()}>
            <TagFilterPanel onClose={() => setFilterOpen(false)} />
          </Show>
        </SearchArea>
        <CreateArea>
          <CreateTaskMenu onSelect={openCreate} />
        </CreateArea>
        <CreateAreaMobile>
          <CreateTaskMenu onSelect={openCreate} />
        </CreateAreaMobile>
      </Toolbar>

      <ColumnGrid>
        <For each={taskTypeOrder}>
          {(type) => (
            <TaskColumn
              type={type}
              onEdit={(task) => {
                if (!isRunningYesterdailies()) {
                  setModal({
                    kind: 'edit',
                    task,
                  });
                }
              }}
              onDelete={(task) => setDeleting(task)}
            />
          )}
        </For>
      </ColumnGrid>

      <TaskModal
        mode={modal()}
        onClose={() => setModal(null)}
        onCreate={createOne}
        onSave={saveOne}
        onDelete={(task) => setDeleting(task)}
      />
      <DeleteConfirmModal
        task={deleting()}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
      <YesterdailiesModal
        dailies={yesterdailies()}
        onStart={finishCron}
      />
    </Page>
  );
}
