import { Row } from '@/components/ui/Layout';
import { twc } from '@/styles/twc';

export const Page = twc(
  'div',
  [
    'mx-auto',
    'w-full',
    'max-w-[1140px]',
    'px-3',
    'pt-4',
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
  [
    'grid',
    'grid-cols-1',
    'gap-6',
    'md:grid-cols-2',
    'lg:grid-cols-3',
  ],
);
