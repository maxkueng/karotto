import type { TaskType } from '@karotto/core';
import Plus from 'lucide-solid/icons/plus';
import { For } from 'solid-js';
import {
  taskTypeOrder,
  taskTypes,
} from '@/components/tasks/taskTypes';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { twc } from '@/styles/twc';

const CreateIcon = twc(
  Plus,
  ['text-purple-500'],
);

const TypeIconSlot = twc(
  'span',
  [
    'flex',
    'w-[30px]',
    'justify-center',
    'text-gray-200',
  ],
);

type CreateTaskMenuProps = {
  onSelect: (type: TaskType) => void;
};

export function CreateTaskMenu(props: CreateTaskMenuProps) {
  return (
    <Menu
      spacing="padded"
      trigger={() => (
        <Button icon={(
          <CreateIcon
            size={10}
            stroke-width={4}
          />
        )}
        >
          Add Task
        </Button>
      )}
    >
      {(close) => (
        <For each={taskTypeOrder}>
          {(type) => (
            <Button
              layout="list"
              size="sm"
              icon={<TypeIconSlot>{taskTypes[type].icon(20)}</TypeIconSlot>}
              onClick={() => {
                close();
                props.onSelect(type);
              }}
            >
              {taskTypes[type].label}
            </Button>
          )}
        </For>
      )}
    </Menu>
  );
}
