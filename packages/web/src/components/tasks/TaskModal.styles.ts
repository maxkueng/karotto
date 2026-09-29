import { InputGroup } from '@/components/ui/Input';
import { twc } from '@/styles/twc';

export const ModalHeader = twc(
  'div',
  [
    'rounded-t-md',
    'p-6',
    'bg-(--task-bg)',
    'text-(--task-heading)',
  ],
);

export const HeaderField = twc(
  'div',
  ['mt-3'],
);

export const HeaderLabel = twc(
  'label',
  [
    'text-[14px]',
    'font-bold',
    'leading-[1.71]',
  ],
);

const headerInputBase = [
  'mt-0',
  'w-full',
  'rounded-xs',
  'border-0',
  'bg-white/50',
  'px-3',
  'py-1',
  'text-[14px]',
  'leading-[1.71]',
  'text-black',
  'outline-none',
  'placeholder:text-(--task-dark)',
  'placeholder:opacity-70',
  'hover:bg-white/75',
  'focus:bg-white/75',
  'focus:shadow-[0_0_0_1px_var(--task-dark)]',
];

export const TitleInput = twc(
  'input',
  [
    ...headerInputBase,
    'h-8',
  ],
);

export const NotesInput = twc(
  'textarea',
  [
    ...headerInputBase,
    'h-14',
    'resize-none',
  ],
);

export const ModalBody = twc(
  'div',
  [
    'px-6',
    'pb-2',
    'text-neutral-50',
  ],
);

export const HabitOptionCircle = twc(
  'span',
  [
    'flex',
    'h-10',
    'w-10',
    'items-center',
    'justify-center',
    'rounded-full',
    'transition-colors',
  ],
  {
    variants: {
      enabled: {
        true: [
          'bg-(--task-bg)',
          'text-white',
        ],
        false: [
          'border-2',
          'border-neutral-300',
          'bg-transparent',
          'text-neutral-200',
          'group-hover/opt:border-brand-300',
        ],
      },
    },
    defaultVariants: { enabled: 'true' },
  },
);

export const HabitOptionLabel = twc(
  'span',
  [
    'mt-1',
    'text-[12px]',
  ],
  {
    variants: {
      enabled: {
        true: [
          'font-bold',
          'text-(--task-bg)',
        ],
        false: [
          'text-neutral-100',
          'group-hover/opt:text-brand-300',
        ],
      },
    },
    defaultVariants: { enabled: 'true' },
  },
);

export const AdvancedSection = twc(
  'div',
  [
    '-mx-6',
    'mt-4',
    'min-h-12',
    'bg-neutral-700',
    'px-6',
    'py-3',
  ],
);

export const StreakInputGroup = twc(
  InputGroup,
  ['w-40'],
);

export const CounterGroup = twc(
  InputGroup,
  ['flex-1'],
);

export const FooterCenter = twc(
  'div',
  [
    'my-6',
    'text-center',
  ],
);
