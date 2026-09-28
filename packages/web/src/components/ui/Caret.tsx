import { twc } from '@/styles/twc';

export const Caret = twc(
  'span',
  [
    'inline-block',
    'border-4',
    'border-transparent',
  ],
  {
    variants: {
      direction: {
        down: [
          'translate-y-[2px]',
          'border-t-current',
        ],
        right: ['border-l-current'],
      },
      tone: {
        current: [],
        muted: ['text-gray-200'],
        purple: ['text-purple-600'],
      },
      placement: {
        inline: [],
        end: [
          'ml-auto',
          'mr-1',
        ],
        after: ['ml-1'],
      },
    },
    defaultVariants: {
      direction: 'down',
      tone: 'current',
      placement: 'inline',
    },
  },
);
