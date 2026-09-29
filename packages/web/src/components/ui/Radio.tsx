import type { JSX } from 'solid-js';
import { ControlText } from '@/components/ui/Checkbox';
import { twc } from '@/styles/twc';

const RadioLabel = twc(
  'label',
  [
    'inline-flex',
    'cursor-pointer',
    'items-center',
    'gap-2',
  ],
);

const HiddenInput = twc(
  'input',
  [
    'peer',
    'sr-only',
  ],
);

const RadioRing = twc(
  'span',
  [
    'flex',
    'h-[18px]',
    'w-[18px]',
    'items-center',
    'justify-center',
    'rounded-full',
    'border-2',
    'transition-colors',
    'peer-focus-visible:ring-2',
    'peer-focus-visible:ring-brand-400/50',
  ],
  {
    variants: {
      checked: {
        true: [
          'border-brand-400',
          'bg-neutral-700',
        ],
        false: ['border-neutral-200'],
      },
    },
    defaultVariants: { checked: 'false' },
  },
);

const RadioDot = twc(
  'span',
  [
    'h-[6px]',
    'w-[6px]',
    'rounded-full',
    'bg-brand-400',
  ],
  {
    variants: {
      checked: {
        true: [],
        false: ['opacity-0'],
      },
    },
    defaultVariants: { checked: 'false' },
  },
);

type RadioProps = {
  checked: boolean;
  onSelect: () => void;
  label: JSX.Element;
  name: string;
};

export function Radio(props: RadioProps) {
  return (
    <RadioLabel>
      <HiddenInput
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={() => props.onSelect()}
      />
      <RadioRing checked={props.checked}>
        <RadioDot checked={props.checked} />
      </RadioRing>
      <ControlText>{props.label}</ControlText>
    </RadioLabel>
  );
}
