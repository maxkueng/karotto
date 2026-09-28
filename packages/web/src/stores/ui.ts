import { createSignal } from 'solid-js';

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

export function toggleSelectedTag(id: string): void {
  setSelectedTagIds((ids) => (ids.includes(id)
    ? ids.filter((item) => item !== id)
    : [
        ...ids,
        id,
      ]));
}
