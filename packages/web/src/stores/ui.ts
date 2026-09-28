import { defaultActiveFilter } from '@karotto/core';
import type {
  ActiveFilter,
  TaskType,
} from '@karotto/core';
import {
  createEffect,
  createSignal,
} from 'solid-js';

const FILTER_KEY = 'karotto.activeFilter';

function loadActiveFilter(): ActiveFilter {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) {
      return defaultActiveFilter;
    }
    return {
      ...defaultActiveFilter,
      ...(JSON.parse(raw) as Partial<ActiveFilter>),
    };
  } catch {
    return defaultActiveFilter;
  }
}

export const [
  searchQuery,
  setSearchQuery,
] = createSignal('');

export const [
  selectedTagIds,
  setSelectedTagIds,
] = createSignal<string[]>([]);

export const [
  isRunningYesterdailies,
  setRunningYesterdailies,
] = createSignal(false);

/** Which list view each column shows; a per-browser choice, not synced across clients. */
export const [
  activeFilter,
  setActiveFilterState,
] = createSignal<ActiveFilter>(loadActiveFilter());

createEffect(() => {
  try {
    localStorage.setItem(
      FILTER_KEY,
      JSON.stringify(activeFilter()),
    );
  } catch {
    // Storage may be unavailable (private mode, quota); the in-memory value still works.
  }
});

export function setActiveFilter<T extends TaskType>(
  type: T,
  value: ActiveFilter[T],
): void {
  setActiveFilterState((current) => ({
    ...current,
    [type]: value,
  }));
}

export function toggleSelectedTag(id: string): void {
  setSelectedTagIds((ids) => (ids.includes(id)
    ? ids.filter((item) => item !== id)
    : [
        ...ids,
        id,
      ]));
}
