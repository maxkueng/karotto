import type { ServerEvent } from '@karotto/core';
import {
  onCleanup,
  onMount,
} from 'solid-js';
import type { ParentComponent } from 'solid-js';
import { CLIENT_ID } from '@/api/client';
import { transport } from '@/api/transport';
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
    const handlers = new Map<string, (event: ServerEvent) => void>();

    const on = <T extends ServerEvent['type']>(
      type: T,
      handler: (event: EventOf<T>) => void,
    ) => {
      handlers.set(
        type,
        handler as (event: ServerEvent) => void,
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

    const stop = transport().listen({
      types: [...handlers.keys()],
      onEvent: (
        type,
        event,
      ) => {
        const serverEvent = event as ServerEvent;
        if (serverEvent.origin !== CLIENT_ID) {
          handlers.get(type)?.(serverEvent);
        }
      },
      onReconnect: () => {
        void tasks.reload();
        void tags.load();
        void session.refresh();
      },
    });

    onCleanup(stop);
  });

  return <>{props.children}</>;
};
