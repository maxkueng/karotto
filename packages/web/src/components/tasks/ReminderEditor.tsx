import type {
  Reminder,
  TaskType,
} from '@karotto/core';
import AlarmClock from 'lucide-solid/icons/alarm-clock';
import Plus from 'lucide-solid/icons/plus';
import Trash from 'lucide-solid/icons/trash';
import { DateTime } from 'luxon';
import {
  For,
  Show,
} from 'solid-js';
import { Button } from '@/components/ui/Button';
import {
  FieldGroup,
  Input,
  Label,
} from '@/components/ui/Input';
import {
  Row,
  Spacer,
} from '@/components/ui/Layout';
import { newId } from '@/lib/ids';
import { useSession } from '@/stores/session';
import { twc } from '@/styles/twc';

const ReminderRow = twc(
  Row,
  ['mt-1'],
);

const ClockIcon = twc(
  AlarmClock,
  ['text-gray-200'],
);

const TimeInput = twc(
  Input,
  ['w-40'],
);

const DateTimeInput = twc(
  Input,
  ['w-60'],
);

type ReminderEditorProps = {
  type: TaskType;
  reminders: Reminder[];
  onChange: (reminders: Reminder[]) => void;
};

export function ReminderEditor(props: ReminderEditorProps) {
  const session = useSession();
  const zone = () => session.dayContext().timezone;
  const isTodo = () => props.type === 'todo';

  const toLocal = (iso: string) => DateTime.fromISO(
    iso,
    { zone: zone() },
  );

  const add = () => {
    const base = DateTime.now().setZone(zone()).plus({ hours: 1 }).startOf('hour');
    props.onChange([
      ...props.reminders,
      {
        id: newId(),
        time: base.toUTC().toISO() ?? '',
        startDate: null,
      },
    ]);
  };

  const update = (
    id: string,
    value: string,
  ) => {
    props.onChange(props.reminders.map((reminder) => {
      if (reminder.id !== id) {
        return reminder;
      }
      let next: DateTime;
      if (isTodo()) {
        next = DateTime.fromISO(
          value,
          { zone: zone() },
        );
      } else {
        const [
          hours,
          minutes,
        ] = value.split(':').map((part) => Number.parseInt(
          part,
          10,
        ));
        next = toLocal(reminder.time).set({
          hour: hours ?? 0,
          minute: minutes ?? 0,
          second: 0,
          millisecond: 0,
        });
      }
      if (!next.isValid) {
        return reminder;
      }
      return {
        ...reminder,
        time: next.toUTC().toISO() ?? reminder.time,
      };
    }));
  };

  return (
    <FieldGroup>
      <Label>Reminders</Label>
      <For each={props.reminders}>
        {(reminder) => (
          <ReminderRow gap="sm">
            <ClockIcon size={14} />
            <Show
              when={isTodo()}
              fallback={(
                <TimeInput
                  size="sm"
                  type="time"
                  aria-label="Reminder time"
                  value={toLocal(reminder.time).toFormat('HH:mm')}
                  onChange={(event) => update(
                    reminder.id,
                    event.currentTarget.value,
                  )}
                />
              )}
            >
              <DateTimeInput
                size="sm"
                type="datetime-local"
                aria-label="Reminder date and time"
                value={toLocal(reminder.time).toFormat('yyyy-MM-dd\'T\'HH:mm')}
                onChange={(event) => update(
                  reminder.id,
                  event.currentTarget.value,
                )}
              />
            </Show>
            <Button
              layout="icon-danger"
              aria-label="Remove reminder"
              icon={<Trash size={14} />}
              onClick={() => props.onChange(props.reminders.filter((item) => item.id !== reminder.id))}
            />
          </ReminderRow>
        )}
      </For>
      <Spacer top="sm">
        <Button
          layout="link"
          size="sm"
          icon={(
            <Plus
              size={10}
              stroke-width={3}
            />
          )}
          onClick={add}
        >
          Add reminder
        </Button>
      </Spacer>
    </FieldGroup>
  );
}
