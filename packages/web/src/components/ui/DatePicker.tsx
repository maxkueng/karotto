import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  formatIsoDate as toIso,
  parseIsoDate,
  weekday,
} from '@karotto/core';
import type {
  DateFormat,
  IsoDate,
} from '@karotto/core';
import Calendar from 'lucide-solid/icons/calendar';
import ChevronLeft from 'lucide-solid/icons/chevron-left';
import ChevronRight from 'lucide-solid/icons/chevron-right';
import X from 'lucide-solid/icons/x';
import {
  createMemo,
  createSignal,
  For,
  Show,
} from 'solid-js';
import { Button } from '@/components/ui/Button';
import { InputGroup } from '@/components/ui/Input';
import {
  FloatingPanel,
  Row,
} from '@/components/ui/Layout';
import {
  formatIsoDate,
  monthName,
  WEEKDAY_LABELS,
} from '@/lib/dates';
import { createDismissable } from '@/lib/dismiss';
import { twc } from '@/styles/twc';

const PickerRoot = twc(
  'div',
  ['relative'],
);

const Placeholder = twc(
  'span',
  ['text-neutral-200'],
);

const CalendarPanel = twc(
  FloatingPanel,
  [
    'min-w-[280px]',
    'p-2',
  ],
);

const QuickDateBand = twc(
  Row,
  [
    'mb-2',
    'h-10',
    'bg-neutral-700',
    'px-2',
  ],
);

const MonthHeader = twc(
  Row,
  [
    'mb-1',
    'px-1',
  ],
);

const MonthLabel = twc(
  'span',
  [
    'text-[14px]',
    'font-bold',
    'text-neutral-50',
  ],
);

const DayGrid = twc(
  'div',
  [
    'grid',
    'grid-cols-7',
    'text-center',
  ],
);

const WeekdayHeading = twc(
  'div',
  [
    'py-1',
    'text-[12px]',
    'font-bold',
    'text-neutral-100',
  ],
);

type DatePickerProps = {
  value: IsoDate | null;
  onChange: (value: IsoDate | null) => void;
  today: IsoDate;
  format: DateFormat;
  clearable?: boolean;
  placeholder?: string;
  id?: string;
};

export function DatePicker(props: DatePickerProps) {
  const [
    open,
    setOpen,
  ] = createSignal(false);
  const [
    viewMonth,
    setViewMonth,
    // eslint-disable-next-line solid/reactivity -- initial month only; it is reset every time the picker opens
  ] = createSignal<IsoDate>(props.value ?? props.today);
  let root: HTMLDivElement | undefined;

  createDismissable({
    root: () => root,
    active: open,
    onDismiss: () => setOpen(false),
  });

  const toggle = () => {
    const next = !open();
    if (next) {
      setViewMonth(props.value ?? props.today);
    }
    setOpen(next);
  };

  const select = (value: IsoDate | null) => {
    props.onChange(value);
    setOpen(false);
  };

  const grid = createMemo(() => {
    const parsed = parseIsoDate(viewMonth());
    if (!parsed) {
      return {
        label: '',
        cells: [] as (IsoDate | null)[],
      };
    }
    const first = toIso({
      year: parsed.year,
      month: parsed.month,
      day: 1,
    });
    const leading = weekday(first);
    const total = daysInMonth(
      parsed.year,
      parsed.month,
    );
    const cells: (IsoDate | null)[] = [];
    for (let i = 0; i < leading; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= total; day += 1) {
      cells.push(toIso({
        year: parsed.year,
        month: parsed.month,
        day,
      }));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return {
      label: `${monthName(parsed.month)} ${parsed.year}`,
      cells,
    };
  });

  return (
    <PickerRoot ref={(element: HTMLDivElement) => {
      root = element;
    }}
    >
      <InputGroup>
        <Button
          layout="field-value"
          id={props.id}
          onClick={toggle}
        >
          <Show
            when={props.value}
            fallback={<Placeholder>{props.placeholder ?? 'Select a date'}</Placeholder>}
          >
            {(value) => formatIsoDate(
              value(),
              props.format,
            )}
          </Show>
        </Button>
        <Show when={props.clearable && props.value}>
          <Button
            layout="icon-danger"
            aria-label="Clear date"
            icon={<X size={12} />}
            onClick={() => select(null)}
          />
        </Show>
        <Button
          layout="field-addon"
          aria-label="Open calendar"
          icon={<Calendar size={12} />}
          onClick={toggle}
        />
      </InputGroup>
      <Show when={open()}>
        <CalendarPanel>
          <QuickDateBand gap="sm">
            <Button
              layout="chip"
              onClick={() => select(props.today)}
            >
              Today
            </Button>
            <Button
              layout="chip"
              onClick={() => select(addDays(
                props.today,
                1,
              ))}
            >
              Tomorrow
            </Button>
          </QuickDateBand>
          <MonthHeader justify="between">
            <Button
              layout="icon"
              aria-label="Previous month"
              icon={<ChevronLeft size={16} />}
              onClick={() => setViewMonth((month) => addMonthsClamped(
                month,
                -1,
              ))}
            />
            <MonthLabel>{grid().label}</MonthLabel>
            <Button
              layout="icon"
              aria-label="Next month"
              icon={<ChevronRight size={16} />}
              onClick={() => setViewMonth((month) => addMonthsClamped(
                month,
                1,
              ))}
            />
          </MonthHeader>
          <DayGrid>
            <For each={WEEKDAY_LABELS}>
              {(label) => <WeekdayHeading>{label}</WeekdayHeading>}
            </For>
            <For each={grid().cells}>
              {(cell) => (
                <Show
                  when={cell}
                  fallback={<div />}
                >
                  {(day) => (
                    <Button
                      layout="calendar-day"
                      active={day() === props.value}
                      highlighted={day() === props.today}
                      onClick={() => select(day())}
                    >
                      {parseIsoDate(day())?.day}
                    </Button>
                  )}
                </Show>
              )}
            </For>
          </DayGrid>
        </CalendarPanel>
      </Show>
    </PickerRoot>
  );
}
