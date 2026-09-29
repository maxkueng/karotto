import type { Task } from '@karotto/core';
import ArrowDownToLine from 'lucide-solid/icons/arrow-down-to-line';
import ArrowUpToLine from 'lucide-solid/icons/arrow-up-to-line';
import EllipsisVertical from 'lucide-solid/icons/ellipsis-vertical';
import ListChecks from 'lucide-solid/icons/list-checks';
import Minus from 'lucide-solid/icons/minus';
import Pencil from 'lucide-solid/icons/pencil';
import Plus from 'lucide-solid/icons/plus';
import Trash from 'lucide-solid/icons/trash';
import {
  createMemo,
  For,
  Show,
} from 'solid-js';
import { Markdown } from '@/components/tasks/Markdown';
import {
  paletteFor,
  paletteVars,
} from '@/components/tasks/palette';
import {
  Card,
  CardBody,
  CardRow,
  CardWrapper,
  CheckControlStrip,
  CheckGlyph,
  ChecklistArea,
  ChecklistItems,
  ChecklistPillSlot,
  ChecklistText,
  ClickableArea,
  DueDateBadge,
  DueDateIcon,
  HabitControlStrip,
  IconsRight,
  IconsRow,
  OptionsSlot,
  StreakIcon,
  TagsAnchor,
  TagsIcon,
  TagsPopover,
  TagsPopoverLabel,
  TaskNotes,
  TaskTitle,
  TitleRow,
} from '@/components/tasks/TaskCard.styles';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Caret } from '@/components/ui/Caret';
import { Checkbox } from '@/components/ui/Checkbox';
import { Row } from '@/components/ui/Layout';
import { Menu } from '@/components/ui/Menu';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  formatIsoDate,
  isOverdue,
  todayIso,
} from '@/lib/dates';
import { useSession } from '@/stores/session';
import { useTags } from '@/stores/tags';
import { twc } from '@/styles/twc';

const PurpleArrowUp = twc(
  ArrowUpToLine,
  ['text-brand-300'],
);
const PurpleArrowDown = twc(
  ArrowDownToLine,
  ['text-brand-300'],
);

export type TaskCardProps = {
  task: Task;
  onScore: (direction: 'up' | 'down') => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveTop?: () => void;
  onMoveBottom?: () => void;
  onToggleChecklistItem?: (itemId: string) => void;
  onToggleCollapse?: (collapsed: boolean) => void;
  yesterdaily?: boolean;
};

function habitCounterText(task: Task): string | null {
  if (task.type !== 'habit' || (!task.up && !task.down)) {
    return null;
  }
  if (task.up && task.down) {
    const up = `${task.counterUp > 0 ? '+' : ''}${task.counterUp}`;
    const down = `${task.counterDown > 0 ? '-' : ''}${task.counterDown}`;
    return `${up} | ${down}`;
  }
  return String(task.up ? task.counterUp : task.counterDown);
}

export function TaskCard(props: TaskCardProps) {
  const session = useSession();
  const tags = useTags();

  const palette = createMemo(() => paletteFor(props.task));
  const completed = () => props.task.type !== 'habit' && props.task.completed;
  const dimmed = () => {
    const task = props.task;
    if (task.type === 'habit') {
      return false;
    }
    if (task.completed) {
      return true;
    }
    return task.type === 'daily' && !props.yesterdaily && !task.isDue;
  };

  const checklist = () => (props.task.type === 'habit' ? [] : props.task.checklist);
  const checklistDone = () => checklist().filter((item) => item.completed).length;
  const expanded = () => props.task.type === 'habit' || !props.task.collapseChecklist;

  const tagNames = createMemo(() => props.task.tags
    .map((id) => tags.byId(id)?.name)
    .filter((name): name is string => name !== undefined));

  const habitControl = (side: 'up' | 'down') => {
    const task = props.task;
    if (task.type !== 'habit') {
      return null;
    }
    const enabled = side === 'up' ? task.up : task.down;
    return (
      <HabitControlStrip
        side={side}
        enabled={enabled}
      >
        <Button
          layout={enabled ? 'control-habit' : 'control-habit-off'}
          aria-label={side === 'up' ? 'Score up' : 'Score down'}
          disabled={!enabled}
          icon={side === 'up'
            ? (
                <Plus
                  size={10}
                  stroke-width={4}
                />
              )
            : (
                <Minus
                  size={10}
                  stroke-width={4}
                />
              )}
          onClick={() => props.onScore(side)}
        />
      </HabitControlStrip>
    );
  };

  return (
    <CardWrapper data-task-id={props.task.id}>
      <Card
        style={paletteVars(palette())}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target === event.currentTarget) {
            props.onEdit?.();
          }
        }}
      >
        <CardRow>
          <Show
            when={props.task.type === 'habit'}
            fallback={(
              <CheckControlStrip dimmed={dimmed()}>
                <Button
                  layout="control-check"
                  highlighted={dimmed()}
                  role="checkbox"
                  aria-checked={completed()}
                  aria-label={completed() ? 'Mark incomplete' : 'Mark complete'}
                  icon={(
                    <CheckGlyph
                      size={16}
                      stroke-width={4}
                      completed={completed()}
                      dimmed={dimmed()}
                    />
                  )}
                  onClick={() => props.onScore(completed() ? 'down' : 'up')}
                />
              </CheckControlStrip>
            )}
          >
            {habitControl('up')}
          </Show>

          <CardBody
            shape={props.task.type === 'habit' ? 'habit' : 'checkable'}
            dimmed={dimmed()}
          >
            <ClickableArea onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) {
                return;
              }
              props.onEdit?.();
            }}
            >
              <TitleRow
                align="start"
                justify="between"
              >
                <Markdown
                  source={props.task.text}
                  as={(titleProps) => (
                    <TaskTitle
                      {...titleProps}
                      hasNotes={props.task.notes !== ''}
                      dimmed={dimmed()}
                    />
                  )}
                />
                <Show when={props.onEdit && !props.yesterdaily}>
                  <OptionsSlot>
                    <Menu
                      reveal="hover"
                      trigger={(open) => (
                        <Tooltip text="Options">
                          <Button
                            layout="icon"
                            active={open}
                            aria-label="Task options"
                            icon={<EllipsisVertical size={16} />}
                          />
                        </Tooltip>
                      )}
                    >
                      {(close) => (
                        <>
                          <Button
                            layout="list"
                            icon={<Pencil size={16} />}
                            onClick={() => {
                              close();
                              props.onEdit?.();
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            layout="list"
                            icon={<PurpleArrowUp size={14} />}
                            onClick={() => {
                              close();
                              props.onMoveTop?.();
                            }}
                          >
                            To top
                          </Button>
                          <Button
                            layout="list"
                            icon={<PurpleArrowDown size={14} />}
                            onClick={() => {
                              close();
                              props.onMoveBottom?.();
                            }}
                          >
                            To bottom
                          </Button>
                          <Button
                            layout="list-danger"
                            icon={<Trash size={16} />}
                            onClick={() => {
                              close();
                              props.onDelete?.();
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </Menu>
                  </OptionsSlot>
                </Show>
              </TitleRow>
              <Show when={props.task.notes}>
                <Markdown
                  source={props.task.notes}
                  as={(notesProps) => (
                    <TaskNotes
                      {...notesProps}
                      hasChecklist={checklist().length > 0}
                      dimmed={dimmed()}
                    />
                  )}
                />
              </Show>
            </ClickableArea>

            <Show when={checklist().length > 0}>
              <ChecklistArea expanded={expanded()}>
                <ChecklistPillSlot>
                  <Button
                    layout="pill"
                    aria-expanded={expanded()}
                    icon={<ListChecks size={10} />}
                    iconRight={(
                      <Caret
                        direction={expanded() ? 'down' : 'right'}
                        placement="after"
                      />
                    )}
                    onClick={() => props.onToggleCollapse?.(expanded())}
                  >
                    {`${checklistDone()}/${checklist().length}`}
                  </Button>
                </ChecklistPillSlot>
                <Show when={expanded()}>
                  <ChecklistItems>
                    <For each={checklist()}>
                      {(item) => (
                        <Checkbox
                          checked={item.completed}
                          onChange={() => props.onToggleChecklistItem?.(item.id)}
                          label={(
                            <Markdown
                              source={item.text}
                              inline
                              as={(textProps) => (
                                <ChecklistText
                                  {...textProps}
                                  completed={item.completed}
                                />
                              )}
                            />
                          )}
                        />
                      )}
                    </For>
                  </ChecklistItems>
                </Show>
              </ChecklistArea>
            </Show>

            <IconsRow>
              <Show when={props.task.type === 'todo' && props.task.dueDate}>
                {(dueDate) => (
                  <DueDateBadge
                    gap="xs"
                    overdue={isOverdue(
                      dueDate(),
                      session.dayContext(),
                    )}
                  >
                    <DueDateIcon size={14} />
                    <span>
                      {dueDate() === todayIso(session.dayContext())
                        ? 'Today'
                        : formatIsoDate(
                            dueDate(),
                            session.dateFormat(),
                          )}
                    </span>
                  </DueDateBadge>
                )}
              </Show>
              <IconsRight
                gap="sm"
                justify="end"
              >
                <Show when={props.task.type === 'daily'}>
                  <Tooltip text="Streak Counter">
                    <Row gap="xs">
                      <StreakIcon size={12} />
                      <span>{props.task.type === 'daily' ? props.task.streak : 0}</span>
                    </Row>
                  </Tooltip>
                </Show>
                <Show when={habitCounterText(props.task)}>
                  {(text) => (
                    <Tooltip text="Counter">
                      <Row gap="xs">
                        <StreakIcon size={12} />
                        <span>{text()}</span>
                      </Row>
                    </Tooltip>
                  )}
                </Show>
                <Show when={tagNames().length > 0}>
                  <TagsAnchor>
                    <TagsIcon size={14} />
                    <TagsPopover>
                      <TagsPopoverLabel>Tags:</TagsPopoverLabel>
                      <For each={tagNames()}>{(name) => <Badge tone="tag-dark">{name}</Badge>}</For>
                    </TagsPopover>
                  </TagsAnchor>
                </Show>
              </IconsRight>
            </IconsRow>
          </CardBody>

          <Show when={props.task.type === 'habit'}>{habitControl('down')}</Show>
        </CardRow>
      </Card>
    </CardWrapper>
  );
}
