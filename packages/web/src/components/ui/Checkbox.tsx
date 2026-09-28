import Check from 'lucide-solid/icons/check';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { twc } from '@/styles/twc';

const CheckboxLabel = twc(
  'label',
  [
    'inline-flex',
    'cursor-pointer',
    'items-start',
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

const CheckboxBox = twc(
  'span',
  [
    'mt-[3px]',
    'flex',
    'h-[18px]',
    'w-[18px]',
    'shrink-0',
    'items-center',
    'justify-center',
    'rounded-xs',
    'border-2',
    'transition-colors',
    'peer-focus-visible:ring-2',
    'peer-focus-visible:ring-purple-400/50',
  ],
  {
    variants: {
      checked: {
        true: [
          'border-purple-400',
          'bg-purple-400',
          'text-white',
        ],
        false: [
          'border-gray-200',
          'bg-transparent',
        ],
      },
      dimmed: {
        true: ['opacity-60'],
        false: [],
      },
    },
    defaultVariants: {
      checked: 'false',
      dimmed: 'false',
    },
  },
);

export const ControlText = twc(
  'span',
  [
    'text-[14px]',
    'leading-[1.71]',
    'text-gray-50',
    'break-words',
  ],
);

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: JSX.Element;
  disabled?: boolean;
};

export function Checkbox(props: CheckboxProps) {
  return (
    <CheckboxLabel>
      <HiddenInput
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <CheckboxBox
        checked={props.checked}
        dimmed={props.disabled === true}
      >
        <Show when={props.checked}>
          <Check
            size={13}
            stroke-width={3}
          />
        </Show>
      </CheckboxBox>
      <Show when={props.label !== undefined}>
        <ControlText>{props.label}</ControlText>
      </Show>
    </CheckboxLabel>
  );
}
