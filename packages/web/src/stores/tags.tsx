import type { Tag } from '@karotto/core';
import {
  createContext,
  createMemo,
  createSignal,
  useContext,
} from 'solid-js';
import type {
  Accessor,
  ParentComponent,
} from 'solid-js';
import { tagApi } from '@/api';

type TagsApi = {
  tags: Accessor<Tag[]>;
  load: () => Promise<void>;
  create: (name: string) => Promise<Tag>;
  rename: (
    id: string,
    name: string,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
  byId: (id: string) => Tag | undefined;
  applyRemote: (list: Tag[]) => void;
};

const TagsContext = createContext<TagsApi>();

export const TagsProvider: ParentComponent = (props) => {
  const [
    tags,
    setTags,
  ] = createSignal<Tag[]>([]);
  const byId = createMemo(() => new Map(tags().map((tag) => [
    tag.id,
    tag,
  ])));

  const load = async () => {
    setTags(await tagApi.list());
  };

  const create = async (name: string) => {
    const tag = await tagApi.create(name);
    setTags((list) => [
      ...list,
      tag,
    ]);
    return tag;
  };

  const rename = async (
    id: string,
    name: string,
  ) => {
    const tag = await tagApi.update(
      id,
      name,
    );
    setTags((list) => list.map((item) => (item.id === id ? tag : item)));
  };

  const remove = async (id: string) => {
    await tagApi.remove(id);
    setTags((list) => list.filter((item) => item.id !== id));
  };

  const reorder = async (ids: string[]) => {
    const byId = new Map(tags().map((tag) => [
      tag.id,
      tag,
    ]));
    setTags(ids.map((id) => byId.get(id)).filter((tag): tag is Tag => tag !== undefined));
    setTags(await tagApi.reorder(ids));
  };

  return (
    <TagsContext.Provider value={{
      tags,
      load,
      applyRemote: setTags,
      create,
      rename,
      remove,
      reorder,
      byId: (id) => byId().get(id),
    }}
    >
      {props.children}
    </TagsContext.Provider>
  );
};

export function useTags(): TagsApi {
  const value = useContext(TagsContext);
  if (!value) {
    throw new Error('TagsProvider missing');
  }
  return value;
}
