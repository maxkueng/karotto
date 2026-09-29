import { Row } from '@/components/ui/Layout';
import { twc } from '@/styles/twc';

export const ColumnSection = twc(
  'section',
  [
    'flex',
    'min-h-[556px]',
    'flex-col',
  ],
);

export const ColumnHeader = twc(
  Row,
  ['h-14'],
);

export const FilterTabs = twc(
  Row,
  ['ml-auto'],
);

export const TaskList = twc(
  'div',
  [
    'relative',
    'flex',
    'flex-1',
    'flex-col',
    'rounded-sm',
    'bg-neutral-600',
    'p-2',
    'pb-[30px]',
  ],
);

export const QuickAddInput = twc(
  'textarea',
  [
    'w-full',
    'resize-none',
    'overflow-hidden',
    'rounded-xs',
    'border',
    'border-transparent',
    'px-4',
    'py-3',
    'text-[14px]',
    'leading-[1.43]',
    'transition-colors',
    'placeholder:font-bold',
    'placeholder:text-neutral-200',
  ],
  {
    variants: {
      focused: {
        true: [
          'mb-0',
          'border-brand-500',
          'bg-surface',
          'text-neutral-50',
          'focus:outline-none',
        ],
        false: [
          'mb-[3px]',
          'bg-well',
          'hover:bg-well-hover',
        ],
      },
    },
    defaultVariants: { focused: 'false' },
  },
);

export const QuickAddTip = twc(
  'div',
  [
    'quick-add-tip',
    'p-4',
    'text-center',
    'text-[12px]',
    'leading-[1.33]',
    'text-neutral-200',
  ],
);

export const ClearCompletedBox = twc(
  'div',
  [
    'p-4',
    'text-center',
  ],
);

export const EmptyState = twc(
  'div',
  [
    'pointer-events-none',
    'absolute',
    'inset-x-0',
    'top-[30%]',
    'px-6',
    'text-center',
  ],
);

export const EmptyStateIcon = twc(
  'div',
  [
    'mx-auto',
    'mb-3',
    'flex',
    'justify-center',
    'text-neutral-300',
  ],
);

export const SortableList = twc(
  'div',
  [
    'flex',
    'flex-col',
    'gap-0.5',
    'sortable-tasks',
  ],
);
