import type {
  ApiToken,
  ApiTokenCreated,
  CronResult,
  CronStatus,
  LoginInput,
  OkResponse,
  PreferencesUpdate,
  ScoreDirection,
  ScoreRequest,
  ScoreResult,
  Tag,
  Task,
  TaskCreateInput,
  TaskType,
  User,
} from '@karotto/core';
import { api } from '@/api/client';

export const authApi = {
  login: (input: LoginInput) => api.post<User>(
    '/auth/login',
    input,
  ),
  logout: () => api.post<OkResponse>('/auth/logout'),
  session: () => api.get<User>('/auth/session'),
};

export const userApi = {
  me: () => api.get<User>('/user'),
  updatePreferences: (patch: PreferencesUpdate) => api.patch<User>(
    '/user/preferences',
    patch,
  ),
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => api.put<OkResponse>(
    '/user/password',
    {
      currentPassword,
      newPassword,
    },
  ),
  tokens: () => api.get<ApiToken[]>('/user/tokens'),
  createToken: (name: string) => api.post<ApiTokenCreated>(
    '/user/tokens',
    { name },
  ),
  revokeToken: (id: string) => api.delete<OkResponse>(`/user/tokens/${id}`),
};

export const tagApi = {
  list: () => api.get<Tag[]>('/tags'),
  create: (name: string) => api.post<Tag>(
    '/tags',
    { name },
  ),
  update: (
    id: string,
    name: string,
  ) => api.patch<Tag>(
    `/tags/${id}`,
    { name },
  ),
  remove: (id: string) => api.delete<OkResponse>(`/tags/${id}`),
  reorder: (ids: string[]) => api.put<Tag[]>(
    '/tags/order',
    { ids },
  ),
};

export type TaskListType = 'habits' | 'dailies' | 'todos' | 'completedTodos';

export const taskApi = {
  list: (type?: TaskListType) => api.get<Task[]>(type ? `/tasks?type=${type}` : '/tasks'),
  create: (inputs: TaskCreateInput[]) => api.post<Task[]>(
    '/tasks',
    inputs,
  ),
  update: (
    id: string,
    patch: Record<string, unknown>,
  ) => api.patch<Task>(
    `/tasks/${id}`,
    patch,
  ),
  remove: (id: string) => api.delete<OkResponse>(`/tasks/${id}`),
  score: (
    id: string,
    direction: ScoreDirection,
  ) => api.post<ScoreResult>(`/tasks/${id}/score/${direction}`),
  move: (
    id: string,
    position: number,
  ) => api.post<{ ids: string[] }>(`/tasks/${id}/move/${position}`),
  setOrder: (
    type: TaskType,
    ids: string[],
  ) => api.put<{ ids: string[] }>(
    '/tasks/order',
    {
      type,
      ids,
    },
  ),
  toggleChecklistItem: (
    id: string,
    itemId: string,
  ) => api.post<Task>(`/tasks/${id}/checklist/${itemId}/score`),
  clearCompleted: () => api.post<{ deleted: number }>('/tasks/clear-completed'),
};

export const cronApi = {
  status: () => api.get<CronStatus>('/cron/status'),
  run: (scores: ScoreRequest[]) => api.post<CronResult>(
    '/cron',
    { scores },
  ),
};
