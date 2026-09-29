import {
  everyDay,
  validateDailyRules,
} from '@karotto/core';
import type {
  ChecklistItem,
  HabitFrequency,
  Reminder,
  Task,
  TaskCreateInput,
  TaskType,
} from '@karotto/core';
import FastForward from 'lucide-solid/icons/fast-forward';
import Minus from 'lucide-solid/icons/minus';
import Plus from 'lucide-solid/icons/plus';
import Trash from 'lucide-solid/icons/trash';
import type { JSX } from 'solid-js';
import {
  createMemo,
  createSignal,
  Show,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { ChecklistEditor } from '@/components/tasks/ChecklistEditor';
import {
  palettes,
  paletteFor,
  paletteVars,
} from '@/components/tasks/palette';
import { ReminderEditor } from '@/components/tasks/ReminderEditor';
import { ScheduleEditor } from '@/components/tasks/ScheduleEditor';
import type { ScheduleDraft } from '@/components/tasks/ScheduleEditor';
import { TagSelect } from '@/components/tasks/TagSelect';
import {
  AdvancedSection,
  CounterGroup,
  FooterCenter,
  HabitOptionCircle,
  HabitOptionLabel,
  HeaderField,
  HeaderLabel,
  ModalBody,
  ModalHeader,
  NotesInput,
  StreakInputGroup,
  TitleInput,
} from '@/components/tasks/TaskModal.styles';
import { taskTypes } from '@/components/tasks/taskTypes';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { DisclosureChevron } from '@/components/ui/Disclosure';
import {
  FieldGroup,
  InputGroupAddon,
  InputGroupField,
  Label,
  Select,
} from '@/components/ui/Input';
import {
  Row,
  Spacer,
} from '@/components/ui/Layout';
import { Modal } from '@/components/ui/Modal';
import {
  Heading,
  Text,
} from '@/components/ui/Typography';
import { todayIso } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { useSession } from '@/stores/session';

export type TaskModalMode
  = { kind: 'create';
    type: TaskType;
    tags: string[]; }
    | { kind: 'edit';
      task: Task; };

type Draft = {
  text: string;
  notes: string;
  tags: string[];
  reminders: Reminder[];
  checklist: ChecklistItem[];
  collapseChecklist: boolean;
  up: boolean;
  down: boolean;
  counterUp: number;
  counterDown: number;
  habitFrequency: HabitFrequency;
  schedule: ScheduleDraft;
  streak: number;
  dueDate: string | null;
};

type TaskModalProps = {
  mode: TaskModalMode | null;
  onClose: () => void;
  onCreate: (input: TaskCreateInput) => Promise<void>;
  onSave: (
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  onDelete: (task: Task) => void;
};

function draftFrom(
  mode: TaskModalMode,
  today: string,
): Draft {
  const base: Draft = {
    text: '',
    notes: '',
    tags: [],
    reminders: [],
    checklist: [],
    collapseChecklist: false,
    up: true,
    down: true,
    counterUp: 0,
    counterDown: 0,
    habitFrequency: 'daily',
    schedule: {
      frequency: 'weekly',
      everyX: 1,
      startDate: today,
      repeat: everyDay,
      daysOfMonth: [],
      weeksOfMonth: [],
    },
    streak: 0,
    dueDate: null,
  };
  if (mode.kind === 'create') {
    return {
      ...base,
      tags: mode.tags,
    };
  }
  const task = mode.task;
  const draft: Draft = {
    ...base,
    text: task.text,
    notes: task.notes,
    tags: [...task.tags],
    reminders: task.reminders.map((reminder) => ({ ...reminder })),
  };
  switch (task.type) {
    case 'habit':
      return {
        ...draft,
        up: task.up,
        down: task.down,
        counterUp: task.counterUp,
        counterDown: task.counterDown,
        habitFrequency: task.frequency,
      };
    case 'daily':
      return {
        ...draft,
        checklist: task.checklist.map((item) => ({ ...item })),
        collapseChecklist: task.collapseChecklist,
        schedule: {
          frequency: task.frequency,
          everyX: task.everyX,
          startDate: task.startDate,
          repeat: { ...task.repeat },
          daysOfMonth: [...task.daysOfMonth],
          weeksOfMonth: [...task.weeksOfMonth],
        },
        streak: task.streak,
      };
    case 'todo':
      return {
        ...draft,
        checklist: task.checklist.map((item) => ({ ...item })),
        collapseChecklist: task.collapseChecklist,
        dueDate: task.dueDate,
      };
  }
}

function parseCount(value: string): number {
  return Math.max(
    0,
    Number.parseInt(
      value,
      10,
    ) || 0,
  );
}

export function TaskModal(props: TaskModalProps) {
  const session = useSession();
  const today = () => todayIso(session.dayContext());

  return (
    <Show
      when={props.mode}
      keyed
    >
      {(mode) => (
        <TaskModalBody
          mode={mode}
          today={today()}
          onClose={props.onClose}
          onCreate={props.onCreate}
          onSave={props.onSave}
          onDelete={props.onDelete}
        />
      )}
    </Show>
  );
}

type BodyProps = Omit<TaskModalProps, 'mode'> & {
  mode: TaskModalMode;
  today: string;
};

function TaskModalBody(props: BodyProps) {
  const session = useSession();
  const type = (): TaskType => (props.mode.kind === 'create' ? props.mode.type : props.mode.task.type);
  const isEdit = () => props.mode.kind === 'edit';
  /* eslint-disable solid/reactivity -- the body is keyed on mode, so the draft is initialised once per open */
  const initialDraft = draftFrom(
    props.mode,
    props.today,
  );
  /* eslint-enable solid/reactivity */
  const [
    draft,
    setDraft,
  ] = createStore<Draft>(initialDraft);
  const [
    pendingChecklist,
    setPendingChecklist,
  ] = createSignal('');
  const [
    advancedOpen,
    setAdvancedOpen,
  ] = createSignal(false);
  const [
    saving,
    setSaving,
  ] = createSignal(false);
  const [
    error,
    setError,
  ] = createSignal<string | null>(null);

  const palette = createMemo(() => (props.mode.kind === 'edit' ? paletteFor(props.mode.task) : palettes.brand));

  const canSave = () => draft.text.trim() !== '' && !saving();

  const checklistWithPending = () => {
    const pending = pendingChecklist().trim();
    if (pending === '') {
      return draft.checklist;
    }
    return [
      ...draft.checklist,
      {
        id: newId(),
        text: pending,
        completed: false,
      },
    ];
  };

  const buildPayload = (): Record<string, unknown> => {
    const common = {
      text: draft.text.trim(),
      notes: draft.notes,
      tags: draft.tags,
      reminders: draft.reminders,
    };
    switch (type()) {
      case 'habit':
        return {
          ...common,
          up: draft.up,
          down: draft.down,
          counterUp: draft.counterUp,
          counterDown: draft.counterDown,
          frequency: draft.habitFrequency,
        };
      case 'daily':
        return {
          ...common,
          checklist: checklistWithPending(),
          collapseChecklist: draft.collapseChecklist,
          ...draft.schedule,
          streak: draft.streak,
        };
      case 'todo':
        return {
          ...common,
          checklist: checklistWithPending(),
          collapseChecklist: draft.collapseChecklist,
          dueDate: draft.dueDate,
        };
    }
  };

  const submit = async () => {
    if (!canSave()) {
      return;
    }
    if (type() === 'daily') {
      const problem = validateDailyRules(draft.schedule);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (props.mode.kind === 'create') {
        await props.onCreate({
          type: type(),
          ...payload,
        } as TaskCreateInput);
      } else {
        await props.onSave(
          props.mode.task.id,
          payload,
        );
      }
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the task');
    } finally {
      setSaving(false);
    }
  };

  const title = () => `${isEdit() ? 'Edit' : 'Create'} ${taskTypes[type()].label}`;

  return (
    <Modal
      open
      label={title()}
      onClose={props.onClose}
    >
      <form
        style={paletteVars(palette())}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <ModalHeader>
          <Row justify="between">
            <Heading level="modal">{title()}</Heading>
            <Row gap="md">
              <Button
                layout="plain"
                onClick={props.onClose}
              >
                Cancel
              </Button>
              <Button
                layout="secondary"
                type="submit"
                disabled={!canSave()}
              >
                {isEdit() ? 'Save' : 'Create'}
              </Button>
            </Row>
          </Row>
          <HeaderField>
            <HeaderLabel for="task-title">Title*</HeaderLabel>
            <TitleInput
              id="task-title"
              placeholder="Add a title"
              autofocus
              value={draft.text}
              onInput={(event) => setDraft(
                'text',
                event.currentTarget.value,
              )}
            />
          </HeaderField>
          <HeaderField>
            <HeaderLabel for="task-notes">Notes</HeaderLabel>
            <NotesInput
              id="task-notes"
              placeholder="Add notes"
              value={draft.notes}
              onInput={(event) => setDraft(
                'notes',
                event.currentTarget.value,
              )}
            />
          </HeaderField>
        </ModalHeader>

        <ModalBody>
          <Show when={type() === 'habit'}>
            <Spacer top="lg">
              <Row
                gap="xl"
                justify="center"
              >
                <HabitOption
                  label="Positive"
                  enabled={draft.up}
                  icon={(
                    <Plus
                      size={10}
                      stroke-width={4}
                    />
                  )}
                  onToggle={() => setDraft(
                    'up',
                    !draft.up,
                  )}
                />
                <HabitOption
                  label="Negative"
                  enabled={draft.down}
                  icon={(
                    <Minus
                      size={10}
                      stroke-width={4}
                    />
                  )}
                  onToggle={() => setDraft(
                    'down',
                    !draft.down,
                  )}
                />
              </Row>
            </Spacer>
          </Show>

          <Show when={type() !== 'habit'}>
            <FieldGroup>
              <ChecklistEditor
                items={draft.checklist}
                onChange={(items) => setDraft(
                  'checklist',
                  items,
                )}
                pendingText={pendingChecklist()}
                onPendingChange={setPendingChecklist}
              />
            </FieldGroup>
          </Show>

          <Show when={type() === 'daily'}>
            <ScheduleEditor
              draft={draft.schedule}
              today={props.today}
              onChange={(patch) => setDraft(
                'schedule',
                (current) => ({
                  ...current,
                  ...patch,
                }),
              )}
            />
          </Show>

          <Show when={type() === 'todo'}>
            <FieldGroup>
              <Label for="task-due-date">Due Date</Label>
              <DatePicker
                id="task-due-date"
                value={draft.dueDate}
                onChange={(value) => setDraft(
                  'dueDate',
                  value,
                )}
                today={props.today}
                format={session.dateFormat()}
                clearable
                placeholder="No due date"
              />
            </FieldGroup>
          </Show>

          <FieldGroup>
            <Label>Tags</Label>
            <TagSelect
              selected={draft.tags}
              onChange={(ids) => setDraft(
                'tags',
                ids,
              )}
            />
          </FieldGroup>

          <Show when={type() === 'habit'}>
            <FieldGroup>
              <Label for="task-reset-counter">Reset Counter</Label>
              <Select
                id="task-reset-counter"
                value={draft.habitFrequency}
                onChange={(event) => setDraft(
                  'habitFrequency',
                  event.currentTarget.value as HabitFrequency,
                )}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </FieldGroup>
          </Show>

          <ReminderEditor
            type={type()}
            reminders={draft.reminders}
            onChange={(reminders) => setDraft(
              'reminders',
              reminders,
            )}
          />

          <Show when={isEdit() && type() !== 'todo'}>
            <AdvancedSection>
              <Button
                layout="disclosure"
                block
                aria-expanded={advancedOpen()}
                iconRight={(
                  <DisclosureChevron
                    size={16}
                    flipped={advancedOpen()}
                  />
                )}
                onClick={() => setAdvancedOpen((value) => !value)}
              >
                Advanced Settings
              </Button>
              <Show when={advancedOpen()}>
                <Show when={type() === 'daily'}>
                  <Spacer top="md">
                    <Label for="task-streak">Adjust Streak</Label>
                    <StreakInputGroup>
                      <InputGroupAddon>
                        <FastForward
                          size={12}
                          fill="currentColor"
                        />
                      </InputGroupAddon>
                      <InputGroupField
                        id="task-streak"
                        type="number"
                        min={0}
                        value={draft.streak}
                        onInput={(event) => setDraft(
                          'streak',
                          parseCount(event.currentTarget.value),
                        )}
                      />
                    </StreakInputGroup>
                  </Spacer>
                </Show>
                <Show when={type() === 'habit'}>
                  <Spacer top="md">
                    <Label>Adjust Counter</Label>
                    <Row gap="md">
                      <Show when={draft.up}>
                        <CounterGroup>
                          <InputGroupAddon>
                            <Plus
                              size={10}
                              stroke-width={3}
                            />
                          </InputGroupAddon>
                          <InputGroupField
                            type="number"
                            min={0}
                            aria-label="Positive counter"
                            value={draft.counterUp}
                            onInput={(event) => setDraft(
                              'counterUp',
                              parseCount(event.currentTarget.value),
                            )}
                          />
                        </CounterGroup>
                      </Show>
                      <Show when={draft.down}>
                        <CounterGroup>
                          <InputGroupAddon>
                            <Minus
                              size={10}
                              stroke-width={3}
                            />
                          </InputGroupAddon>
                          <InputGroupField
                            type="number"
                            min={0}
                            aria-label="Negative counter"
                            value={draft.counterDown}
                            onInput={(event) => setDraft(
                              'counterDown',
                              parseCount(event.currentTarget.value),
                            )}
                          />
                        </CounterGroup>
                      </Show>
                    </Row>
                  </Spacer>
                </Show>
              </Show>
            </AdvancedSection>
          </Show>

          <Show when={error()}>
            <Spacer top="md">
              <Text tone="error">{error()}</Text>
            </Spacer>
          </Show>

          <Show
            when={isEdit()}
            fallback={(
              <FooterCenter>
                <Button
                  type="submit"
                  disabled={!canSave()}
                >
                  Create
                </Button>
              </FooterCenter>
            )}
          >
            <FooterCenter>
              <Button
                layout="link-danger"
                icon={<Trash size={16} />}
                onClick={() => {
                  if (props.mode.kind === 'edit') {
                    props.onDelete(props.mode.task);
                  }
                }}
              >
                {`Delete this ${taskTypes[type()].label}`}
              </Button>
            </FooterCenter>
          </Show>
        </ModalBody>
      </form>
    </Modal>
  );
}

type HabitOptionProps = {
  label: string;
  enabled: boolean;
  icon: JSX.Element;
  onToggle: () => void;
};

function HabitOption(props: HabitOptionProps) {
  return (
    <Button
      layout="habit-option"
      aria-pressed={props.enabled}
      onClick={props.onToggle}
    >
      <HabitOptionCircle enabled={props.enabled}>{props.icon}</HabitOptionCircle>
      <HabitOptionLabel enabled={props.enabled}>{props.label}</HabitOptionLabel>
    </Button>
  );
}
