import Calendar from 'lucide-solid/icons/calendar';
import Check from 'lucide-solid/icons/check';
import FastForward from 'lucide-solid/icons/fast-forward';
import TagIcon from 'lucide-solid/icons/tag';
import { Row } from '@/components/ui/Layout';
import { twc } from '@/styles/twc';

export const CardWrapper = twc(
  'div',
  [
    'task-wrapper',
    'mb-[2px]',
  ],
);

export const Card = twc(
  'div',
  [
    'task-card',
    'group',
    'relative',
    'rounded-sm',
    'bg-surface',
    'shadow-card',
    'transition-[box-shadow,outline-color]',
    'duration-150',
    'hover:shadow-card-hover',
    'hover:outline',
    'hover:outline-1',
    'hover:outline-brand-400',
    'focus-within:shadow-card-hover',
  ],
);

export const CardRow = twc(
  'div',
  ['flex'],
);

export const HabitControlStrip = twc(
  'div',
  [
    'flex',
    'w-10',
    'shrink-0',
    'justify-center',
    'pt-4',
  ],
  {
    variants: {
      side: {
        up: [
          'min-h-[60px]',
          'rounded-l-sm',
        ],
        down: [
          'min-h-[56px]',
          'rounded-r-sm',
        ],
      },
      enabled: {
        true: ['bg-(--task-bg)'],
        false: ['bg-neutral-600'],
      },
    },
    defaultVariants: {
      side: 'up',
      enabled: 'true',
    },
  },
);

export const CheckControlStrip = twc(
  'div',
  [
    'flex',
    'w-10',
    'shrink-0',
    'justify-center',
    'rounded-l-sm',
  ],
  {
    variants: {
      dimmed: {
        true: ['bg-neutral-300'],
        false: ['bg-(--task-bg)'],
      },
    },
    defaultVariants: { dimmed: 'false' },
  },
);

export const CheckGlyph = twc(
  Check,
  ['transition-opacity'],
  {
    variants: {
      completed: {
        true: ['opacity-100'],
        false: [
          'opacity-0',
          'group-hover/check:opacity-100',
        ],
      },
      dimmed: {
        true: ['text-surface'],
        false: ['text-white'],
      },
    },
    defaultVariants: {
      completed: 'false',
      dimmed: 'false',
    },
  },
);

export const CardBody = twc(
  'div',
  [
    'min-w-0',
    'flex-1',
    'pb-[7px]',
  ],
  {
    variants: {
      shape: {
        habit: [],
        checkable: ['rounded-r-sm'],
      },
      dimmed: {
        true: ['bg-neutral-600'],
        false: ['bg-surface'],
      },
    },
    defaultVariants: {
      shape: 'checkable',
      dimmed: 'false',
    },
  },
);

export const ClickableArea = twc(
  'div',
  [
    'cursor-pointer',
    'pl-3',
    'pt-1',
  ],
);

export const TitleRow = twc(
  Row,
  [],
);

export const OptionsSlot = twc(
  'div',
  [
    'mr-1',
    'mt-1',
  ],
);

export const TaskTitle = twc(
  'div',
  [
    'markdown',
    'task-title',
    'mt-[6px]',
    'mr-[15px]',
    'break-words',
    'font-condensed',
    'text-[16px]',
    'leading-[1.25]',
    'text-neutral-10',
  ],
  {
    variants: {
      hasNotes: {
        true: [
          'mb-0',
          'pb-1',
        ],
        false: [
          'mb-1',
          'pb-2',
        ],
      },
      dimmed: {
        true: ['opacity-75'],
        false: [],
      },
    },
    defaultVariants: {
      hasNotes: 'false',
      dimmed: 'false',
    },
  },
);

export const TaskNotes = twc(
  'div',
  [
    'markdown',
    'task-notes',
    'small-text',
    'min-w-0',
    'break-words',
    'pr-5',
    'text-neutral-100',
  ],
  {
    variants: {
      hasChecklist: {
        true: ['pb-[2px]'],
        false: [],
      },
      dimmed: {
        true: ['opacity-75'],
        false: [],
      },
    },
    defaultVariants: {
      hasChecklist: 'false',
      dimmed: 'false',
    },
  },
);

export const ChecklistArea = twc(
  'div',
  ['px-2'],
  {
    variants: {
      expanded: {
        true: ['mb-[2px]'],
        false: [],
      },
    },
    defaultVariants: { expanded: 'true' },
  },
);

export const ChecklistPillSlot = twc(
  'div',
  ['mb-2'],
);

export const ChecklistItems = twc(
  'div',
  [
    'flex',
    'flex-col',
  ],
);

export const ChecklistText = twc(
  'span',
  [
    'markdown',
    'mb-[2px]',
  ],
  {
    variants: {
      completed: {
        true: [
          'text-neutral-300',
          'line-through',
        ],
        false: [],
      },
    },
    defaultVariants: { completed: 'false' },
  },
);

export const IconsRow = twc(
  Row,
  [
    'mt-1',
    'px-2',
    'text-[12px]',
    'leading-[1.33]',
    'text-neutral-100',
  ],
);

export const DueDateBadge = twc(
  Row,
  [],
  {
    variants: {
      overdue: {
        true: ['text-maroon-10'],
        false: [],
      },
    },
    defaultVariants: { overdue: 'false' },
  },
);

export const DueDateIcon = twc(
  Calendar,
  ['-mt-[2px]'],
);

export const IconsRight = twc(
  Row,
  ['flex-1'],
);

export const StreakIcon = twc(
  FastForward,
  ['fill-current'],
);

export const TagsAnchor = twc(
  'span',
  [
    'group/tags',
    'relative',
    'flex',
    'items-center',
  ],
);

export const TagsIcon = twc(
  TagIcon,
  ['hover:text-brand-500'],
);

export const TagsPopover = twc(
  'span',
  [
    'pointer-events-none',
    'absolute',
    'bottom-full',
    'right-0',
    'z-[1500]',
    'mb-2',
    'w-max',
    'max-w-[300px]',
    'rounded-md',
    'bg-neutral-10/95',
    'px-4',
    'py-3',
    'text-[12px]',
    'text-neutral-500',
    'opacity-0',
    'shadow-card',
    'transition-opacity',
    'group-hover/tags:opacity-100',
  ],
);

export const TagsPopoverLabel = twc(
  'span',
  ['mr-1'],
);
