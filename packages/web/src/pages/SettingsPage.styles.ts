import { twc } from '@/styles/twc';

export const Page = twc(
  'div',
  [
    'mx-auto',
    'w-full',
    'max-w-[760px]',
    'px-3',
    'pt-4',
  ],
);

export const NarrowSlot = twc(
  'div',
  ['max-w-xs'],
);

export const MediumSlot = twc(
  'div',
  ['max-w-md'],
);

export const CodeChip = twc(
  'code',
  [
    'rounded-xs',
    'bg-gray-600',
    'px-1',
  ],
);

export const TokenReveal = twc(
  'div',
  [
    'mt-3',
    'rounded-xs',
    'border',
    'border-green-100',
    'bg-green-500/30',
    'p-3',
    'text-[12px]',
  ],
);

export const TokenValue = twc(
  'code',
  [
    'mt-1',
    'block',
    'break-all',
    'select-all',
  ],
);

export const TokenTable = twc(
  'table',
  [
    'mt-4',
    'w-full',
    'text-left',
    'text-[14px]',
  ],
);

export const TokenHeadRow = twc(
  'tr',
  [
    'text-[12px]',
    'text-gray-100',
  ],
);

export const TokenHeadCell = twc(
  'th',
  [
    'py-1',
    'font-bold',
  ],
);

export const TokenRow = twc(
  'tr',
  [
    'border-t',
    'border-gray-600',
  ],
);

export const TokenCell = twc(
  'td',
  ['py-2'],
  {
    variants: {
      look: {
        text: [],
        mono: [
          'font-mono',
          'text-[12px]',
        ],
        muted: [
          'text-[12px]',
          'text-gray-100',
        ],
        actions: ['text-right'],
        empty: [
          'text-[12px]',
          'text-gray-200',
        ],
      },
    },
    defaultVariants: { look: 'text' },
  },
);
