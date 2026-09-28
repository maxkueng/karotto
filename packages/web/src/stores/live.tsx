import type { ServerEvent } from '@karotto/core';
import {
  onCleanup,
  onMount,
} from 'solid-js';
import type { ParentComponent } from 'solid-js';
import {
  BASE,
  CLIENT_ID,
} from '@/api/client';
import { useSession } from '@/stores/session';
import { useTags } from '@/stores/tags';
import { useTasks } from '@/stores/tasks';

type EventOf<T extends ServerEvent['type']> = Extract<ServerEvent, { type: T }>;

/** Keeps the stores in sync with changes made from other clients via the SSE stream. */
export const LiveProvider: ParentComponent = (props) => {
  const session = useSession();
  const tasks = useTasks();
  const tags = useTags();

  onMount(() => {
    const source = new EventSource(`${BASE}/events`);
    let interrupted = false;

    const resync = () => {
      void tasks.reload();
      void tags.load();
      void session.refresh();
    };

    source.addEventListener(
      'open',
      () => {
        if (interrupted) {
          interrupted = false;
          resync();
        }
      },
    );
    source.addEventListener(
      'error',
      () => {
        interrupted = true;
      },
    );

    const on = <T extends ServerEvent['type']>(
      type: T,
      handler: (event: EventOf<T>) => void,
    ) => {
      source.addEventListener(
        type,
        (message: MessageEvent<string>) => {
          const event = JSON.parse(message.data) as EventOf<T>;
          if (event.origin === CLIENT_ID) {
            return;
          }
          handler(event);
        },
      );
    };

    on(
      'task.upserted',
      (event) => tasks.applyRemote(event.task),
    );
    on(
      'task.deleted',
      (event) => tasks.removeRemote(event.id),
    );
    on(
      'tasks.reordered',
      (event) => tasks.applyRemoteOrder(
        event.taskType,
        event.ids,
      ),
    );
    on(
      'tasks.invalidated',
      () => void tasks.reload(),
    );
    on(
      'tags.changed',
      (event) => tags.applyRemote(event.tags),
    );
    on(
      'user.updated',
      (event) => session.applyRemote(event.user),
    );

    onCleanup(() => source.close());
  });

  return <>{props.children}</>;
};
