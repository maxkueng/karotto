import {
  everyDay,
  parseIsoDate,
  repeatDayKeys,
  weekday,
  weekOfMonthByDay,
} from '@karotto/core';
import type {
  DailyFrequency,
  IsoDate,
  Repeat,
  RepeatDayKey,
} from '@karotto/core';
import TriangleAlert from 'lucide-solid/icons/triangle-alert';
import {
  createMemo,
  Show,
} from 'solid-js';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  FieldGroup,
  Input,
  Label,
  Select,
} from '@/components/ui/Input';
import { Row } from '@/components/ui/Layout';
import { Radio } from '@/components/ui/Radio';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { Text } from '@/components/ui/Typography';
import {
  longDate,
  ordinal,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from '@/lib/dates';
import { useSession } from '@/stores/session';
import { twc } from '@/styles/twc';

const EveryXInput = twc(
  Input,
  ['w-24'],
);

const Summary = twc(
  Text,
  ['mt-3'],
);

const Warning = twc(
  Row,
  [
    'mt-1',
    'text-[12px]',
    'leading-4',
    'text-gray-50',
  ],
);

const WarningIcon = twc(
  TriangleAlert,
  ['text-yellow-10'],
);

export type ScheduleDraft = {
  frequency: DailyFrequency;
  everyX: number;
  startDate: IsoDate;
  repeat: Repeat;
  daysOfMonth: number[];
  weeksOfMonth: number[];
};

type ScheduleEditorProps = {
  draft: ScheduleDraft;
  onChange: (patch: Partial<ScheduleDraft>) => void;
  today: IsoDate;
};

const units: Record<DailyFrequency, string> = {
  daily: 'day(s)',
  weekly: 'week(s)',
  monthly: 'month(s)',
  yearly: 'year(s)',
};

const noDays = Object.fromEntries(repeatDayKeys.map((key) => [
  key,
  false,
])) as Repeat;

export function monthlyFromStart(
  startDate: IsoDate,
  mode: 'dayOfMonth' | 'dayOfWeek',
): Partial<ScheduleDraft> {
  const date = parseIsoDate(startDate);
  if (!date) {
    return {};
  }
  if (mode === 'dayOfMonth') {
    return {
      daysOfMonth: [date.day],
      weeksOfMonth: [],
    };
  }
  const key = repeatDayKeys[weekday(startDate)] as RepeatDayKey;
  return {
    daysOfMonth: [],
    weeksOfMonth: [weekOfMonthByDay(startDate)],
    repeat: {
      ...noDays,
      [key]: true,
    },
  };
}

export function ScheduleEditor(props: ScheduleEditorProps) {
  const session = useSession();
  const monthlyMode = createMemo<'dayOfMonth' | 'dayOfWeek'>(() => (props.draft.weeksOfMonth.length > 0 ? 'dayOfWeek' : 'dayOfMonth'));

  const selectedDays = createMemo(() => repeatDayKeys.filter((key) => props.draft.repeat[key]));

  const summary = createMemo(() => {
    const draft = props.draft;
    const every = draft.everyX === 1 ? '' : ` ${draft.everyX}`;
    const plural = draft.everyX === 1 ? '' : 's';
    switch (draft.frequency) {
      case 'daily':
        return draft.everyX === 1 ? 'Repeats every day' : `Repeats every ${draft.everyX} days`;
      case 'weekly': {
        const names = selectedDays().map((key) => WEEKDAY_NAMES[repeatDayKeys.indexOf(key)]);
        if (names.length === 0) {
          return 'Never repeats: choose at least one day';
        }
        const days = names.length === 7 ? 'every day' : names.join(', ');
        return `Repeats every${every} week${plural} on ${days}`;
      }
      case 'monthly': {
        const start = parseIsoDate(draft.startDate);
        if (!start) {
          return '';
        }
        if (monthlyMode() === 'dayOfWeek') {
          const week = draft.weeksOfMonth[0] ?? 0;
          const dayName = WEEKDAY_NAMES[weekday(draft.startDate)];
          return `Repeats every${every} month${plural} on the ${ordinal(week + 1)} ${dayName}`;
        }
        return `Repeats every${every} month${plural} on the ${ordinal(start.day)}`;
      }
      case 'yearly':
        return `Repeats every${every} year${plural} on ${longDate(draft.startDate)}`;
    }
  });

  const fifthWeekWarning = createMemo(() => props.draft.frequency === 'monthly' && monthlyMode() === 'dayOfWeek' && props.draft.weeksOfMonth[0] === 4);

  const setStartDate = (value: IsoDate | null) => {
    if (!value) {
      return;
    }
    const patch: Partial<ScheduleDraft> = { startDate: value };
    if (props.draft.frequency === 'monthly') {
      Object.assign(
        patch,
        monthlyFromStart(
          value,
          monthlyMode(),
        ),
      );
    }
    props.onChange(patch);
  };

  const setFrequency = (frequency: DailyFrequency) => {
    const patch: Partial<ScheduleDraft> = { frequency };
    if (frequency === 'monthly') {
      Object.assign(
        patch,
        monthlyFromStart(
          props.draft.startDate,
          monthlyMode(),
        ),
      );
    } else if (props.draft.frequency === 'monthly') {
      patch.daysOfMonth = [];
      patch.weeksOfMonth = [];
      if (frequency === 'weekly' && selectedDays().length <= 1) {
        patch.repeat = everyDay;
      }
    }
    props.onChange(patch);
  };

  return (
    <>
      <FieldGroup>
        <Label for="task-start-date">Start Date</Label>
        <DatePicker
          id="task-start-date"
          value={props.draft.startDate}
          onChange={setStartDate}
          today={props.today}
          format={session.dateFormat()}
        />
      </FieldGroup>
      <FieldGroup>
        <Label for="task-frequency">Repeats</Label>
        <Select
          id="task-frequency"
          value={props.draft.frequency}
          onChange={(event) => setFrequency(event.currentTarget.value as DailyFrequency)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </FieldGroup>
      <FieldGroup>
        <Label for="task-every-x">Repeat Every</Label>
        <Row>
          <EveryXInput
            id="task-every-x"
            size="sm"
            type="number"
            min={1}
            max={9999}
            value={props.draft.everyX}
            onInput={(event) => {
              const value = Number.parseInt(
                event.currentTarget.value,
                10,
              );
              if (Number.isFinite(value) && value >= 1 && value <= 9999) {
                props.onChange({ everyX: value });
              }
            }}
          />
          <Badge tone="unit">{units[props.draft.frequency]}</Badge>
        </Row>
      </FieldGroup>
      <Show when={props.draft.frequency === 'weekly'}>
        <FieldGroup>
          <Label>Repeat On</Label>
          <ToggleGroup
            options={repeatDayKeys.map((
              key,
              index,
            ) => ({
              value: key,
              label: WEEKDAY_LABELS[index] ?? key,
            }))}
            selected={selectedDays()}
            onToggle={(key) => props.onChange({
              repeat: {
                ...props.draft.repeat,
                [key]: !props.draft.repeat[key],
              },
            })}
          />
        </FieldGroup>
      </Show>
      <Show when={props.draft.frequency === 'monthly'}>
        <FieldGroup>
          <Label>Repeat On</Label>
          <Row gap="lg">
            <Radio
              name="monthly-mode"
              label="Day of the Month"
              checked={monthlyMode() === 'dayOfMonth'}
              onSelect={() => props.onChange(monthlyFromStart(
                props.draft.startDate,
                'dayOfMonth',
              ))}
            />
            <Radio
              name="monthly-mode"
              label="Day of the Week"
              checked={monthlyMode() === 'dayOfWeek'}
              onSelect={() => props.onChange(monthlyFromStart(
                props.draft.startDate,
                'dayOfWeek',
              ))}
            />
          </Row>
        </FieldGroup>
      </Show>
      <Summary tone="summary">{summary()}</Summary>
      <Show when={fifthWeekWarning()}>
        <Warning gap="sm">
          <WarningIcon size={16} />
          <span>
            This task
            {' '}
            <strong>will not</strong>
            {' '}
            appear due during months with fewer
            {' '}
            {WEEKDAY_NAMES[weekday(props.draft.startDate)]}
            s.
          </span>
        </Warning>
      </Show>
    </>
  );
}
