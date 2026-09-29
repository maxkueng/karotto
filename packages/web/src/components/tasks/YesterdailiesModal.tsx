import type { Task } from '@karotto/core';
import {
  createSignal,
  For,
  Show,
} from 'solid-js';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button } from '@/components/ui/Button';
import { Spacer } from '@/components/ui/Layout';
import { Modal } from '@/components/ui/Modal';
import {
  Heading,
  Text,
} from '@/components/ui/Typography';
import { twc } from '@/styles/twc';

const Body = twc(
  'div',
  [
    'px-4',
    'pb-4',
    'text-center',
  ],
);

const DailyList = twc(
  'div',
  [
    'mt-3',
    'max-h-[50vh]',
    'overflow-y-auto',
    'rounded-sm',
    'bg-neutral-600',
    'p-2',
    'text-left',
  ],
);

const StartSlot = twc(
  'div',
  [
    'mb-4',
    'mt-6',
  ],
);

type YesterdailiesModalProps = {
  dailies: Task[] | null;
  onStart: (completedIds: string[]) => Promise<void>;
};

export function YesterdailiesModal(props: YesterdailiesModalProps) {
  const [
    checked,
    setChecked,
  ] = createSignal<Set<string>>(new Set<string>());
  const [
    loading,
    setLoading,
  ] = createSignal(false);

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = new Set<string>(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const start = async () => {
    if (loading()) {
      return;
    }
    setLoading(true);
    try {
      await props.onStart([...checked()]);
      setChecked(new Set<string>());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.dailies}>
      {(dailies) => (
        <Modal
          open
          width={362}
          label="Welcome back"
          closeOnBackdrop={false}
          closeOnEscape={false}
        >
          <Body>
            <Spacer top="lg">
              <Heading level="welcome">Welcome back!</Heading>
            </Spacer>
            <Spacer top="sm">
              <Text tone="bold">Check off any Dailies you did yesterday:</Text>
            </Spacer>
            <DailyList>
              <For each={dailies()}>
                {(task) => (
                  <TaskCard
                    task={task.type === 'daily'
                      ? {
                          ...task,
                          completed: checked().has(task.id),
                        }
                      : task}
                    yesterdaily
                    onScore={() => toggle(task.id)}
                  />
                )}
              </For>
            </DailyList>
            <StartSlot>
              <Button
                disabled={loading()}
                onClick={() => void start()}
              >
                Start My New Day!
              </Button>
            </StartSlot>
          </Body>
        </Modal>
      )}
    </Show>
  );
}
