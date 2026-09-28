import type { JSX } from 'solid-js';
import { twc } from '@/styles/twc';

const TooltipAnchor = twc(
  'span',
  [
    'group/tip',
    'relative',
    'inline-flex',
  ],
);

const TooltipBubble = twc(
  'span',
  [
    'pointer-events-none',
    'absolute',
    'left-1/2',
    'z-[1500]',
    'w-max',
    'max-w-[220px]',
    '-translate-x-1/2',
    'rounded-sm',
    'bg-gray-10/95',
    'px-3',
    'py-2',
    'text-[12px]',
    'font-normal',
    'leading-[1.33]',
    'text-white',
    'opacity-0',
    'shadow-card',
    'transition-opacity',
    'delay-100',
    'group-hover/tip:opacity-100',
    'bottom-full',
    'mb-2',
  ],
);

type TooltipProps = {
  text: string;
  children: JSX.Element;
};

export function Tooltip(props: TooltipProps) {
  return (
    <TooltipAnchor>
      {props.children}
      <TooltipBubble role="tooltip">
        {props.text}
      </TooltipBubble>
    </TooltipAnchor>
  );
}
