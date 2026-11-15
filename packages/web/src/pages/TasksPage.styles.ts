import { Row } from '@/components/ui/Layout';
import { twc } from '@/styles/twc';

export const Page = twc(
  'div',
  [
    'mx-auto',
    'w-full',
    'px-3',
  ],
  {
    variants: {
      display: {
        true: [
          'flex',
          'h-full',
          'flex-col',
          'py-3',
        ],
        false: [
          'max-w-[1140px]',
          'pt-4',
        ],
      },
    },
    defaultVariants: { display: 'false' },
  },
);

export const PausedBanner = twc(
  Row,
  [
    'mb-3',
    'items-center',
    'gap-2',
    'rounded-md',
    'bg-well',
    'px-4',
    'py-2',
    'text-sm',
    'text-ink',
  ],
);

export const Toolbar = twc(
  Row,
  [
    'relative',
    'mb-5',
  ],
);

export const SearchArea = twc(
  Row,
  [
    'relative',
    'w-full',
    'max-w-[380px]',
  ],
);

export const TagsButtonSlot = twc(
  'div',
  [
    'ml-2',
    'shrink-0',
  ],
);

export const CreateArea = twc(
  'div',
  [
    'absolute',
    'right-0',
    'top-0',
    'hidden',
    'md:block',
  ],
);

export const CreateAreaMobile = twc(
  'div',
  [
    'w-full',
    'text-right',
    'md:hidden',
  ],
);

export const ColumnGrid = twc(
  'div',
  ['grid'],
  {
    variants: {
      display: {
        true: [
          'min-h-0',
          'flex-1',
          'grid-cols-3',
          'grid-rows-1',
          'gap-4',
        ],
        false: [
          'grid-cols-1',
          'gap-6',
          'md:grid-cols-2',
          'md:landscape:grid-cols-3',
          'lg:grid-cols-3',
        ],
      },
    },
    defaultVariants: { display: 'false' },
  },
);
