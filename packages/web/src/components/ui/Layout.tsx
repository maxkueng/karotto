import { twc } from '@/styles/twc';

export const Row = twc(
  'div',
  [
    'flex',
    'items-center',
  ],
  {
    variants: {
      gap: {
        none: [],
        xs: ['gap-1'],
        sm: ['gap-2'],
        md: ['gap-3'],
        lg: ['gap-6'],
        xl: ['gap-8'],
      },
      justify: {
        start: [],
        between: ['justify-between'],
        center: ['justify-center'],
        end: ['justify-end'],
      },
      align: {
        center: [],
        start: ['items-start'],
      },
      wrap: {
        true: ['flex-wrap'],
        false: [],
      },
    },
    defaultVariants: {
      gap: 'none',
      justify: 'start',
      align: 'center',
      wrap: 'false',
    },
  },
);

export const Stack = twc(
  'div',
  [
    'flex',
    'flex-col',
  ],
  {
    variants: {
      gap: {
        none: [],
        xs: ['gap-1'],
        sm: ['gap-2'],
        md: ['gap-3'],
      },
      align: {
        stretch: [],
        center: ['items-center'],
      },
    },
    defaultVariants: {
      gap: 'none',
      align: 'stretch',
    },
  },
);

export const Spacer = twc(
  'div',
  [],
  {
    variants: {
      top: {
        xs: ['mt-1'],
        sm: ['mt-2'],
        md: ['mt-3'],
        lg: ['mt-4'],
        xl: ['mt-6'],
      },
    },
    defaultVariants: { top: 'lg' },
  },
);

export const Card = twc(
  'section',
  [
    'rounded-sm',
    'bg-surface',
    'p-6',
    'shadow-card',
  ],
  {
    variants: {
      spacing: {
        none: [],
        stacked: ['mb-6'],
      },
    },
    defaultVariants: { spacing: 'stacked' },
  },
);

export const FloatingPanel = twc(
  'div',
  [
    'absolute',
    'z-[1100]',
    'rounded-xs',
    'bg-popover',
    'shadow-btn-hover',
  ],
  {
    variants: {
      anchor: {
        below: [
          'left-0',
          'mt-1',
          'w-full',
        ],
        menu: [
          'right-0',
          'mt-2',
          'min-w-[140px]',
          'overflow-hidden',
        ],
      },
    },
    defaultVariants: { anchor: 'below' },
  },
);
