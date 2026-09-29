import { twc } from '@/styles/twc';

const fieldBase = [
  'w-full',
  'rounded-xs',
  'border',
  'border-neutral-400',
  'bg-surface',
  'text-[14px]',
  'leading-[1.43]',
  'text-neutral-50',
  'placeholder:text-neutral-200',
  'hover:border-neutral-300',
  'focus:border-brand-400',
  'focus:outline-none',
  'disabled:opacity-65',
  'disabled:bg-neutral-700',
];

export const Input = twc(
  'input',
  fieldBase,
  {
    variants: {
      size: {
        md: [
          'px-3',
          'py-[10px]',
        ],
        sm: [
          'h-8',
          'px-3',
          'py-1',
        ],
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export const Select = twc(
  'select',
  [
    ...fieldBase,
    'h-8',
    'appearance-none',
    'px-3',
    'py-1',
    'pr-8',
    'bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%275%27><path d=%27M0 0l5 5 5-5z%27 fill=%27%23878190%27/></svg>")]',
    'bg-[length:10px_5px]',
    'bg-[position:right_12px_center]',
    'bg-no-repeat',
  ],
);

export const Label = twc(
  'label',
  [
    'block',
    'text-[14px]',
    'font-bold',
    'leading-[1.71]',
  ],
);

export const FieldGroup = twc(
  'div',
  ['mt-4'],
);

export const InputGroup = twc(
  'div',
  [
    'flex',
    'h-8',
    'items-center',
    'rounded-xs',
    'border',
    'border-neutral-400',
    'bg-surface',
    'focus-within:border-brand-400',
  ],
);

export const InputGroupAddon = twc(
  'span',
  [
    'flex',
    'h-full',
    'w-8',
    'items-center',
    'justify-center',
    'bg-neutral-600',
    'text-neutral-200',
  ],
);

export const InputGroupField = twc(
  'input',
  [
    'h-full',
    'w-full',
    'min-w-0',
    'flex-1',
    'border-0',
    'bg-transparent',
    'px-2',
    'text-[14px]',
    'focus:outline-none',
  ],
);
