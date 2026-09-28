import type { Task } from '@karotto/core';
import TriangleAlert from 'lucide-solid/icons/triangle-alert';
import { Show } from 'solid-js';
import { taskTypes } from '@/components/tasks/taskTypes';
import { Button } from '@/components/ui/Button';
import {
  Spacer,
  Stack,
} from '@/components/ui/Layout';
import { Modal } from '@/components/ui/Modal';
import {
  Heading,
  Text,
} from '@/components/ui/Typography';
import { twc } from '@/styles/twc';

const TopBar = twc(
  'div',
  [
    'h-2',
    'rounded-t-md',
    'bg-maroon-100',
  ],
);

const Body = twc(
  Stack,
  [
    'px-6',
    'pb-6',
    'text-center',
  ],
);

const AlertIcon = twc(
  TriangleAlert,
  [
    'mt-10',
    'text-maroon-100',
  ],
);

type DeleteConfirmModalProps = {
  task: Task | null;
  onCancel: () => void;
  onConfirm: (task: Task) => void;
};

export function DeleteConfirmModal(props: DeleteConfirmModalProps) {
  return (
    <Show when={props.task}>
      {(task) => (
        <Modal
          open
          width={330}
          label={`Delete ${taskTypes[task().type].label}`}
          onClose={props.onCancel}
        >
          <TopBar />
          <Body align="center">
            <AlertIcon size={48} />
            <Spacer top="lg">
              <Heading level="danger">{`Delete ${taskTypes[task().type].label}`}</Heading>
            </Spacer>
            <Spacer top="md">
              <Text tone="bold">Are you sure you want to delete this task?</Text>
            </Spacer>
            <Spacer top="xl">
              <Stack
                gap="sm"
                align="center"
              >
                <Button
                  layout="danger"
                  onClick={() => props.onConfirm(task())}
                >
                  {`Delete ${taskTypes[task().type].label}`}
                </Button>
                <Button
                  layout="link"
                  onClick={props.onCancel}
                >
                  Cancel
                </Button>
              </Stack>
            </Spacer>
          </Body>
        </Modal>
      )}
    </Show>
  );
}
