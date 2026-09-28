import ChevronDown from 'lucide-solid/icons/chevron-down';
import { twc } from '@/styles/twc';

export const DisclosureChevron = twc(
  ChevronDown,
  [
    'text-gray-200',
    'transition-transform',
  ],
  {
    variants: {
      flipped: {
        true: ['rotate-180'],
        false: [],
      },
    },
    defaultVariants: { flipped: 'false' },
  },
);
