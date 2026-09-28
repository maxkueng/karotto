import { twc } from '@/styles/twc';

export const Badge = twc(
  'span',
  [
    'inline-flex',
    'items-center',
    'whitespace-nowrap',
    'rounded-full',
  ],
  {
    variants: {
      tone: {
        count: [
          'mx-1',
          'bg-purple-400',
          'px-2',
          'py-1',
          'text-[10px]',
          'font-bold',
          'leading-[1.2]',
          'text-white',
          'shadow-btn',
        ],
        tag: [
          'h-6',
          'bg-gray-600',
          'pl-3',
          'pr-2',
          'text-[12px]',
          'leading-4',
          'text-gray-100',
        ],
        'tag-dark': [
          'ml-1',
          'bg-gray-50',
          'px-[10px]',
          'py-1',
          'text-gray-300',
        ],
        unit: [
          'ml-3',
          'h-8',
          'rounded-xs',
          'bg-gray-600',
          'px-3',
          'text-[14px]',
          'font-bold',
          'text-gray-50',
        ],
      },
    },
    defaultVariants: { tone: 'tag' },
  },
);
