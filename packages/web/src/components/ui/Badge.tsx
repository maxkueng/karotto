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
          'bg-brand-300',
          'px-2',
          'py-1',
          'text-[10px]',
          'font-bold',
          'leading-[1.2]',
          'text-page',
          'shadow-btn',
        ],
        tag: [
          'h-6',
          'bg-neutral-600',
          'pl-3',
          'pr-2',
          'text-[12px]',
          'leading-4',
          'text-neutral-100',
        ],
        'tag-dark': [
          'ml-1',
          'bg-neutral-50',
          'px-[10px]',
          'py-1',
          'text-neutral-300',
        ],
        unit: [
          'ml-3',
          'h-8',
          'rounded-xs',
          'bg-neutral-600',
          'px-3',
          'text-[14px]',
          'font-bold',
          'text-neutral-50',
        ],
      },
    },
    defaultVariants: { tone: 'tag' },
  },
);
