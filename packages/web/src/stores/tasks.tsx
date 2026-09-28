import {
  scoreDaily,
  scoreHabit,
  scoreTodo,
} from '@karotto/core';
import type {
  ScoreDirection,
  Task,
  TaskCreateInput,
  TaskType,
} from '@karotto/core';
import {
  batch,
  createContext,
  createMemo,
  useContext,
} from 'solid-js';
import type {
  Accessor,
  ParentComponent,
} from 'solid-js';
import {
  createStore,
  produce,
  reconcile,
} from 'solid-js/store';
import { taskApi } from '@/api';
import { useSession } from '@/stores/session';

type TasksState = {
  tasks: Task[];
  completedTodos: Task[];
  loaded: boolean;
  completedLoaded: boolean;
};

type TasksApi = {
  state: TasksState;
  habits: Accessor<Task[]>;
  dailies: Accessor<Task[]>;
  todos: Accessor<Task[]>;
  completedTodos: Accessor<Task[]>;
  load: () => Promise<void>;
  loadCompleted: () => Promise<void>;
  create: (inputs: TaskCreateInput[]) => Promise<Task[]>;
  update: (
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<Task>;
  remove: (id: string) => Promise<void>;
  score: (
    id: string,
    direction: ScoreDirection,
  ) => Promise<void>;
  move: (
    id: string,
    position: number,
  ) => Promise<void>;
  setOrder: (
    type: TaskType,
    ids: string[],
  ) => Promise<void>;
  toggleChecklistItem: (
    id: string,
    itemId: string,
  ) => Promise<void>;
  setCollapsed: (
    id: string,
    collapsed: boolean,
  ) => Promise<void>;
  clearCompleted: () => Promise<void>;
  find: (id: string) => Task | undefined;
  applyRemote: (task: Task) => void;
  removeRemote: (id: string) => void;
  applyRemoteOrder: (
    type: TaskType,
    ids: string[],
  ) => void;
  reload: () => Promise<void>;
};

const TasksContext = createContext<TasksApi>();

export const TasksProvider: ParentComponent = (props) => {
  const session = useSession();
  const [
    state,
    setState,
  ] = createStore<TasksState>({
    tasks: [],
    completedTodos: [],
    loaded: false,
    completedLoaded: false,
  });

  const ofType = (type: TaskType) => createMemo(() => state.tasks.filter((task) => task.type === type));
  const habits = ofType('habit');
  const dailies = ofType('daily');
  const todos = ofType('todo');

  const replaceTask = (next: Task) => {
    const inList = state.tasks.findIndex((task) => task.id === next.id);
    const inCompleted = state.completedTodos.findIndex((task) => task.id === next.id);
    const completedTodo = next.type === 'todo' && next.completed;
    if (inList !== -1 && !completedTodo) {
      setState(
        'tasks',
        inList,
        reconcile(next),
      );
      return;
    }
    if (inCompleted !== -1 && completedTodo) {
      setState(
        'completedTodos',
        inCompleted,
        reconcile(next),
      );
      return;
    }
    setState(produce((draft) => {
      if (inList !== -1) {
        draft.tasks.splice(
          inList,
          1,
        );
      }
      if (inCompleted !== -1) {
        draft.completedTodos.splice(
          inCompleted,
          1,
        );
      }
      if (completedTodo) {
        draft.completedTodos.unshift(next);
      } else {
        draft.tasks.push(next);
      }
    }));
  };

  const load = async () => {
    const list = await taskApi.list();
    batch(() => {
      setState(
        'tasks',
        reconcile(
          list,
          { key: 'id' },
        ),
      );
      setState(
        'loaded',
        true,
      );
    });
  };

  const loadCompleted = async () => {
    const list = await taskApi.list('completedTodos');
    batch(() => {
      setState(
        'completedTodos',
        reconcile(
          list,
          { key: 'id' },
        ),
      );
      setState(
        'completedLoaded',
        true,
      );
    });
  };

  const create = async (inputs: TaskCreateInput[]) => {
    const created = await taskApi.create(inputs);
    setState(produce((draft) => {
      const byType = new Map<TaskType, Task[]>();
      created.forEach((task) => {
        const list = byType.get(task.type) ?? [];
        list.push(task);
        byType.set(
          task.type,
          list,
        );
      });
      byType.forEach((
        list,
        type,
      ) => {
        const first = draft.tasks.findIndex((task) => task.type === type);
        draft.tasks.splice(
          first === -1 ? draft.tasks.length : first,
          0,
          ...list,
        );
      });
    }));
    return created;
  };

  const update = async (
    id: string,
    patch: Record<string, unknown>,
  ) => {
    const updated = await taskApi.update(
      id,
      patch,
    );
    replaceTask(updated);
    return updated;
  };

  const remove = async (id: string) => {
    await taskApi.remove(id);
    setState(produce((draft) => {
      draft.tasks = draft.tasks.filter((task) => task.id !== id);
      draft.completedTodos = draft.completedTodos.filter((task) => task.id !== id);
    }));
  };

  const find = (id: string) => state.tasks.find((task) => task.id === id) ?? state.completedTodos.find((task) => task.id === id);

  const optimistic = (
    task: Task,
    direction: ScoreDirection,
  ): Task => {
    const now = new Date();
    switch (task.type) {
      case 'habit':
        return scoreHabit({
          task,
          direction,
          now,
          ctx: session.dayContext(),
          lastEntry: null,
        }).task;
      case 'daily':
        return scoreDaily({
          task,
          direction,
          now,
          ctx: session.dayContext(),
        }).task;
      case 'todo':
        return scoreTodo({
          task,
          direction,
          now,
        }).task;
    }
  };

  const score = async (
    id: string,
    direction: ScoreDirection,
  ) => {
    const task = find(id);
    if (!task) {
      return;
    }
    const before = task;
    replaceTask(optimistic(
      task,
      direction,
    ));
    try {
      const result = await taskApi.score(
        id,
        direction,
      );
      replaceTask(result.task);
    } catch (error) {
      replaceTask(before);
      throw error;
    }
  };

  const applyOrder = (
    type: TaskType,
    ids: string[],
  ) => {
    setState(produce((draft) => {
      const rank = new Map(ids.map((
        id,
        index,
      ) => [
        id,
        index,
      ]));
      draft.tasks.sort((
        a,
        b,
      ) => {
        if (a.type !== type || b.type !== type) {
          return 0;
        }
        return (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
      });
      draft.tasks.forEach((task) => {
        const index = rank.get(task.id);
        if (index !== undefined) {
          task.position = index;
        }
      });
    }));
  };

  const move = async (
    id: string,
    position: number,
  ) => {
    const task = find(id);
    if (!task) {
      return;
    }
    const ids = state.tasks
      .filter((item) => item.type === task.type && item.id !== id && !(item.type !== 'habit' && item.completed))
      .map((item) => item.id);
    const target = position === -1 || position > ids.length ? ids.length : position;
    ids.splice(
      target,
      0,
      id,
    );
    applyOrder(
      task.type,
      ids,
    );
    const result = await taskApi.move(
      id,
      position,
    );
    applyOrder(
      task.type,
      result.ids,
    );
  };

  const setOrder = async (
    type: TaskType,
    ids: string[],
  ) => {
    applyOrder(
      type,
      ids,
    );
    const result = await taskApi.setOrder(
      type,
      ids,
    );
    applyOrder(
      type,
      result.ids,
    );
  };

  const toggleChecklistItem = async (
    id: string,
    itemId: string,
  ) => {
    const task = find(id);
    if (!task || task.type === 'habit') {
      return;
    }
    replaceTask({
      ...task,
      checklist: task.checklist.map((item) => (item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
          }
        : item)),
    });
    try {
      replaceTask(await taskApi.toggleChecklistItem(
        id,
        itemId,
      ));
    } catch (error) {
      replaceTask(task);
      throw error;
    }
  };

  const setCollapsed = async (
    id: string,
    collapsed: boolean,
  ) => {
    const task = find(id);
    if (!task || task.type === 'habit') {
      return;
    }
    replaceTask({
      ...task,
      collapseChecklist: collapsed,
    });
    replaceTask(await taskApi.update(
      id,
      { collapseChecklist: collapsed },
    ));
  };

  const clearCompleted = async () => {
    await taskApi.clearCompleted();
    setState(
      'completedTodos',
      [],
    );
  };

  const removeRemote = (id: string) => {
    setState(produce((draft) => {
      draft.tasks = draft.tasks.filter((task) => task.id !== id);
      draft.completedTodos = draft.completedTodos.filter((task) => task.id !== id);
    }));
  };

  const reload = async () => {
    await Promise.all([
      load(),
      state.completedLoaded ? loadCompleted() : Promise.resolve(),
    ]);
  };

  return (
    <TasksContext.Provider value={{
      state,
      habits,
      dailies,
      todos,
      completedTodos: () => state.completedTodos,
      load,
      loadCompleted,
      create,
      update,
      remove,
      score,
      move,
      setOrder,
      toggleChecklistItem,
      setCollapsed,
      clearCompleted,
      find,
      applyRemote: replaceTask,
      removeRemote,
      applyRemoteOrder: applyOrder,
      reload,
    }}
    >
      {props.children}
    </TasksContext.Provider>
  );
};

export function useTasks(): TasksApi {
  const value = useContext(TasksContext);
  if (!value) {
    throw new Error('TasksProvider missing');
  }
  return value;
}
