import { A } from '@solidjs/router';
import type {
  ComponentProps,
  JSX,
} from 'solid-js';
import {
  Show,
  splitProps,
} from 'solid-js';
import { twc } from '@/styles/twc';

const baseStyles = [
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-2',
  'whitespace-nowrap',
  'font-sans',
  'transition-[box-shadow,color,border-color,background-color,opacity]',
  'duration-150',
  'focus-visible:outline-none',
  'disabled:cursor-not-allowed',
];

const raisedStyles = [
  'rounded-sm',
  'border-2',
  'border-transparent',
  'px-3',
  'py-0.5',
  'text-[14px]',
  'font-bold',
  'leading-[1.714]',
  'shadow-btn',
  'hover:shadow-btn-hover',
  'active:shadow-none',
  'disabled:shadow-none',
];

const textLinkStyles = [
  'text-[14px]',
  'leading-[1.71]',
  'hover:underline',
  'disabled:text-gray-300',
  'disabled:no-underline',
];

const iconStyles = [
  'rounded-xs',
  'text-gray-200',
  'disabled:opacity-50',
];

const variants = {
  variants: {
    layout: {
      primary: [
        ...raisedStyles,
        'bg-purple-200',
        'text-white',
        'focus-visible:border-purple-400',
        'disabled:bg-transparent',
        'disabled:text-gray-200',
      ],
      secondary: [
        ...raisedStyles,
        'bg-white',
        'text-gray-50',
        'hover:text-purple-300',
        'focus-visible:border-purple-400',
        'focus-visible:text-purple-300',
        'disabled:bg-white',
        'disabled:text-gray-200',
        'disabled:opacity-60',
      ],
      danger: [
        ...raisedStyles,
        'bg-maroon-100',
        'text-white',
        'focus-visible:border-purple-400',
        'disabled:bg-transparent',
        'disabled:text-gray-200',
      ],
      link: [
        ...textLinkStyles,
        'text-purple-300',
      ],
      'link-danger': [
        ...textLinkStyles,
        'text-maroon-50',
      ],
      'link-red': [
        ...textLinkStyles,
        'text-red-50',
      ],
      'link-blue': [
        ...textLinkStyles,
        'text-blue-10',
      ],
      'link-muted': [
        ...textLinkStyles,
        'text-gray-300',
      ],
      plain: [
        ...textLinkStyles,
        'text-current',
      ],
      'snackbar-action': [
        ...textLinkStyles,
        'text-white',
        'font-bold',
        'uppercase',
        'tracking-wide',
        'text-[12px]',
      ],
      icon: [
        ...iconStyles,
        'hover:text-purple-300',
      ],
      'icon-danger': [
        ...iconStyles,
        'hover:text-maroon-50',
      ],
      list: [
        'w-full',
        'justify-start',
        'text-left',
        'text-[14px]',
        'leading-[1.71]',
        'text-gray-50',
        'hover:bg-purple-600/25',
        'hover:text-purple-300',
      ],
      'list-danger': [
        'w-full',
        'justify-start',
        'text-left',
        'text-[14px]',
        'leading-[1.71]',
        'text-red-10',
        'hover:bg-purple-600/25',
      ],
      tab: [
        'p-2',
        'text-[12px]',
        'font-bold',
        'leading-[1.33]',
        'text-gray-100',
        'hover:text-purple-200',
      ],
      toggle: [
        'h-8',
        'flex-1',
        'border',
        'border-gray-400',
        'bg-white',
        'text-[14px]',
        'font-bold',
        'text-gray-50',
        'hover:border-gray-300',
        'hover:text-purple-300',
        'focus-visible:outline',
        'focus-visible:outline-1',
        'focus-visible:outline-purple-400',
      ],
      chip: [
        'h-6',
        'rounded-xs',
        'bg-gray-600',
        'px-3',
        'text-[12px]',
        'font-bold',
        'text-gray-100',
        'hover:text-purple-300',
      ],
      pill: [
        'gap-1',
        'rounded-[1px]',
        'bg-gray-600',
        'px-[6px]',
        'py-[2px]',
        'text-[10px]',
        'leading-[1.2]',
        'text-gray-200',
      ],
      disclosure: [
        'text-[14px]',
        'font-bold',
        'leading-[1.71]',
        'text-gray-10',
      ],
      field: [
        'min-h-8',
        'w-full',
        'flex-wrap',
        'justify-start',
        'gap-1',
        'rounded-xs',
        'border',
        'border-gray-400',
        'bg-white',
        'px-2',
        'py-1',
        'text-left',
        'text-[14px]',
        'hover:border-gray-300',
        'focus:border-purple-400',
      ],
      'field-value': [
        'h-full',
        'flex-1',
        'justify-start',
        'px-3',
        'text-left',
        'text-[14px]',
        'text-gray-50',
      ],
      'field-addon': [
        'h-full',
        'w-8',
        'border-l',
        'border-gray-400',
        'bg-gray-600',
        'text-gray-200',
      ],
      nav: [
        'h-9',
        'rounded-sm',
        'px-3',
        'text-[14px]',
        'font-bold',
        'text-white',
        'hover:bg-purple-200',
        'hover:no-underline',
      ],
      'nav-link': [
        'h-14',
        'rounded-none',
        'px-4',
        'pt-[5px]',
        'text-[16px]',
        'font-bold',
        'text-white',
        'hover:bg-purple-200',
        'hover:no-underline',
      ],
      'calendar-day': [
        'rounded-xs',
        'border',
        'border-transparent',
        'px-1',
        'py-[0.55rem]',
        'text-[14px]',
        'hover:border-purple-400',
      ],
      'control-habit': [
        'h-7',
        'w-7',
        'rounded-full',
        'bg-(--task-inner)',
        'text-white',
        'hover:bg-(--task-inner-hover)',
        'disabled:cursor-default',
      ],
      'control-habit-off': [
        'h-7',
        'w-7',
        'rounded-full',
        'border',
        'border-gray-300',
        'text-gray-200',
        'opacity-75',
        'disabled:cursor-default',
      ],
      'control-check': [
        'group/check',
        'mt-4',
        'h-7',
        'w-7',
        'rounded-xs',
        'bg-white/50',
        'hover:bg-white/75',
      ],
      'habit-option': [
        'group/opt',
        'min-w-12',
        'flex-col',
      ],
    },
    size: {
      md: [],
      sm: [],
      xs: [],
    },
    active: {
      true: [],
      false: [],
    },
    block: {
      true: ['w-full'],
      false: [],
    },
    highlighted: {
      true: [],
      false: [],
    },
    edge: {
      none: [],
      first: ['rounded-l-xs'],
      middle: ['border-l-0'],
      last: [
        'border-l-0',
        'rounded-r-xs',
      ],
      only: ['rounded-xs'],
    },
  },
  compoundVariants: [
    {
      layout: 'primary',
      size: 'sm',
      class: [
        'px-2',
        'py-0',
        'text-[12px]',
        'leading-[2]',
      ],
    },
    {
      layout: 'secondary',
      size: 'sm',
      class: [
        'px-2',
        'py-0',
        'text-[12px]',
        'leading-[2]',
      ],
    },
    {
      layout: 'danger',
      size: 'sm',
      class: [
        'px-2',
        'py-0',
        'text-[12px]',
        'leading-[2]',
      ],
    },
    {
      layout: 'secondary',
      active: 'true',
      class: [
        'border-purple-400',
        'text-purple-300',
      ],
    },
    {
      layout: 'list',
      size: 'md',
      class: [
        'gap-4',
        'py-2',
        'pl-6',
        'pr-4',
      ],
    },
    {
      layout: 'list-danger',
      size: 'md',
      class: [
        'gap-4',
        'py-2',
        'pl-6',
        'pr-4',
      ],
    },
    {
      layout: 'list',
      size: 'sm',
      class: [
        'h-8',
        'px-3',
      ],
    },
    {
      layout: 'list',
      size: 'xs',
      class: [
        'h-8',
        'px-3',
        'text-[12px]',
        'text-gray-100',
      ],
    },
    {
      layout: 'tab',
      active: 'true',
      class: [
        'border-b-2',
        'border-purple-200',
        'pb-[6px]',
        'text-purple-200',
      ],
    },
    {
      layout: 'toggle',
      active: 'true',
      class: [
        'border-purple-100',
        'bg-purple-300',
        'text-white',
        'hover:border-purple-100',
        'hover:text-white',
      ],
    },
    {
      layout: 'calendar-day',
      active: 'true',
      class: [
        'bg-purple-300',
        'font-bold',
        'text-white',
      ],
    },
    {
      layout: 'calendar-day',
      highlighted: 'true',
      active: 'false',
      class: [
        'bg-purple-600/25',
        'font-bold',
        'text-purple-300',
      ],
    },
    {
      layout: 'link',
      size: 'sm',
      class: [
        'text-[12px]',
        'leading-[1.33]',
      ],
    },
    {
      layout: 'link-danger',
      size: 'sm',
      class: [
        'text-[12px]',
        'leading-[1.33]',
      ],
    },
    {
      layout: 'disclosure',
      block: 'true',
      class: ['justify-between'],
    },
    {
      layout: 'icon',
      active: 'true',
      class: [
        'bg-purple-400',
        'text-white',
        'hover:text-white',
      ],
    },
  ],
  defaultVariants: {
    layout: 'primary',
    size: 'md',
    active: 'false',
    block: 'false',
    highlighted: 'false',
    edge: 'none',
  },
} as const;

const ButtonContainer = twc(
  'button',
  baseStyles,
  variants,
);

const LinkContainer = twc(
  A,
  baseStyles,
  variants,
);

export type ButtonLayout = keyof typeof variants.variants.layout;
export type ButtonSize = keyof typeof variants.variants.size;
export type ButtonEdge = keyof typeof variants.variants.edge;

type CommonProps = {
  layout?: ButtonLayout;
  size?: ButtonSize;
  active?: boolean;
  block?: boolean;
  highlighted?: boolean;
  edge?: ButtonEdge;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  children?: JSX.Element;
};

type ButtonElementProps = Omit<ComponentProps<'button'>, keyof CommonProps | 'children' | 'class'> & {
  renderAs?: 'button';
};

type LinkElementProps = Omit<ComponentProps<typeof A>, keyof CommonProps | 'children' | 'class'> & {
  renderAs: 'link';
};

export type ButtonProps = CommonProps & (ButtonElementProps | LinkElementProps);

const variantKeys = [
  'layout',
  'size',
  'active',
  'block',
  'highlighted',
  'edge',
  'icon',
  'iconRight',
  'children',
  'renderAs',
] as const;

export function Button(props: ButtonProps) {
  const [
    local,
    rest,
  ] = splitProps(
    props,
    variantKeys,
  );

  const content = () => (
    <>
      <Show when={local.icon}>{local.icon}</Show>
      {local.children}
      <Show when={local.iconRight}>{local.iconRight}</Show>
    </>
  );

  const variantProps = () => ({
    layout: local.layout ?? 'primary',
    size: local.size ?? 'md',
    active: local.active ?? false,
    block: local.block ?? false,
    highlighted: local.highlighted ?? false,
    edge: local.edge ?? 'none',
  });

  return (
    <Show
      when={local.renderAs === 'link'}
      fallback={(
        <ButtonContainer
          type="button"
          {...(rest as ComponentProps<'button'>)}
          {...variantProps()}
        >
          {content()}
        </ButtonContainer>
      )}
    >
      <LinkContainer
        {...(rest as ComponentProps<typeof A>)}
        {...variantProps()}
      >
        {content()}
      </LinkContainer>
    </Show>
  );
}
