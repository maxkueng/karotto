import { twc } from '@/styles/twc';

export const Heading = twc(
  'h2',
  [
    'font-condensed',
    'font-bold',
    'text-neutral-10',
  ],
  {
    variants: {
      level: {
        page: [
          'mb-4',
          'text-[24px]',
          'leading-[1.33]',
          'font-sans',
          'text-brand-300',
        ],
        section: [
          'text-[20px]',
          'leading-[1.4]',
        ],
        column: [
          'mb-0',
          'truncate',
          'text-[20px]',
          'leading-[1.4]',
        ],
        modal: [
          'text-[20px]',
          'leading-[1.4]',
          'text-current',
        ],
        welcome: [
          'text-[24px]',
          'text-brand-200',
        ],
        brand: ['text-[24px]'],
        empty: [
          'text-[16px]',
          'font-normal',
          'text-neutral-300',
        ],
        danger: [
          'text-[20px]',
          'text-maroon-100',
        ],
      },
    },
    defaultVariants: { level: 'section' },
  },
);

export const Text = twc(
  'p',
  ['leading-[1.43]'],
  {
    variants: {
      tone: {
        body: [
          'text-[14px]',
          'text-neutral-50',
        ],
        bold: [
          'text-[14px]',
          'font-bold',
          'text-neutral-50',
        ],
        help: [
          'text-[12px]',
          'leading-[1.33]',
          'text-neutral-100',
        ],
        muted: [
          'text-[12px]',
          'leading-[1.33]',
          'text-neutral-200',
        ],
        faint: [
          'text-[12px]',
          'leading-[1.33]',
          'text-neutral-300',
        ],
        error: [
          'text-[12px]',
          'leading-[1.33]',
          'text-maroon-100',
        ],
        summary: [
          'text-[12px]',
          'leading-4',
          'text-neutral-50',
        ],
      },
    },
    defaultVariants: { tone: 'body' },
  },
);
