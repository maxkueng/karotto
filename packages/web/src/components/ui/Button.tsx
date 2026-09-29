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
  'disabled:text-neutral-300',
  'disabled:no-underline',
];

const iconStyles = [
  'rounded-xs',
  'text-neutral-200',
  'disabled:opacity-50',
];

const variants = {
  variants: {
    layout: {
      primary: [
        ...raisedStyles,
        'bg-brand-200',
        'text-white',
        'focus-visible:border-brand-400',
        'disabled:bg-transparent',
        'disabled:text-neutral-200',
      ],
      secondary: [
        ...raisedStyles,
        'bg-surface',
        'text-neutral-50',
        'hover:text-brand-300',
        'focus-visible:border-brand-400',
        'focus-visible:text-brand-300',
        'disabled:bg-surface',
        'disabled:text-neutral-200',
        'disabled:opacity-60',
      ],
      danger: [
        ...raisedStyles,
        'bg-maroon-100',
        'text-white',
        'focus-visible:border-brand-400',
        'disabled:bg-transparent',
        'disabled:text-neutral-200',
      ],
      link: [
        ...textLinkStyles,
        'text-brand-300',
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
        'text-neutral-300',
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
        'hover:text-brand-300',
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
        'text-neutral-50',
        'hover:bg-brand-600/25',
        'hover:text-brand-300',
      ],
      'list-danger': [
        'w-full',
        'justify-start',
        'text-left',
        'text-[14px]',
        'leading-[1.71]',
        'text-red-10',
        'hover:bg-brand-600/25',
      ],
      tab: [
        'p-2',
        'text-[12px]',
        'font-bold',
        'leading-[1.33]',
        'text-neutral-100',
        'hover:text-brand-200',
      ],
      toggle: [
        'h-8',
        'flex-1',
        'border',
        'border-neutral-400',
        'bg-surface',
        'text-[14px]',
        'font-bold',
        'text-neutral-50',
        'hover:border-neutral-300',
        'hover:text-brand-300',
        'focus-visible:outline',
        'focus-visible:outline-1',
        'focus-visible:outline-brand-400',
      ],
      chip: [
        'h-6',
        'rounded-xs',
        'bg-neutral-600',
        'px-3',
        'text-[12px]',
        'font-bold',
        'text-neutral-100',
        'hover:text-brand-300',
      ],
      pill: [
        'gap-1',
        'rounded-[1px]',
        'bg-neutral-600',
        'px-[6px]',
        'py-[2px]',
        'text-[10px]',
        'leading-[1.2]',
        'text-neutral-200',
      ],
      disclosure: [
        'text-[14px]',
        'font-bold',
        'leading-[1.71]',
        'text-neutral-10',
      ],
      field: [
        'min-h-8',
        'w-full',
        'flex-wrap',
        'justify-start',
        'gap-1',
        'rounded-xs',
        'border',
        'border-neutral-400',
        'bg-surface',
        'px-2',
        'py-1',
        'text-left',
        'text-[14px]',
        'hover:border-neutral-300',
        'focus:border-brand-400',
      ],
      'field-value': [
        'h-full',
        'flex-1',
        'justify-start',
        'px-3',
        'text-left',
        'text-[14px]',
        'text-neutral-50',
      ],
      'field-addon': [
        'h-full',
        'w-8',
        'border-l',
        'border-neutral-400',
        'bg-neutral-600',
        'text-neutral-200',
      ],
      nav: [
        'h-9',
        'rounded-sm',
        'px-3',
        'text-[14px]',
        'font-bold',
        'text-white',
        'hover:bg-nav-hover',
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
        'hover:bg-nav-hover',
        'hover:no-underline',
      ],
      'calendar-day': [
        'rounded-xs',
        'border',
        'border-transparent',
        'px-1',
        'py-[0.55rem]',
        'text-[14px]',
        'hover:border-brand-400',
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
        'border-neutral-300',
        'text-neutral-200',
        'opacity-75',
        'disabled:cursor-default',
      ],
      'control-check': [
        'group/check',
        'mt-4',
        'h-7',
        'w-7',
        'rounded-xs',
        'bg-(--task-inner)',
        'hover:bg-(--task-inner-hover)',
      ],
      'habit-option': [
        'group/opt',
        'min-w-12',
        'flex-col',
      ],
      'theme-card': [
        'flex-col',
        'items-stretch',
        'gap-2',
        'rounded-sm',
        'border-2',
        'border-neutral-500',
        'bg-surface',
        'p-3',
        'text-left',
        'text-neutral-50',
        'hover:border-brand-400',
        'focus-visible:border-brand-400',
        'focus-visible:outline-none',
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
      layout: 'control-check',
      highlighted: 'true',
      class: [
        'bg-neutral-100',
        'hover:bg-neutral-50',
      ],
    },
    {
      layout: 'theme-card',
      active: 'true',
      class: [
        'border-brand-400',
        'ring-2',
        'ring-brand-400/40',
      ],
    },
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
        'border-brand-400',
        'text-brand-300',
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
        'text-neutral-100',
      ],
    },
    {
      layout: 'tab',
      active: 'true',
      class: [
        'border-b-2',
        'border-brand-200',
        'pb-[6px]',
        'text-brand-200',
      ],
    },
    {
      layout: 'toggle',
      active: 'true',
      class: [
        'border-brand-100',
        'bg-brand-300',
        'text-white',
        'hover:border-brand-100',
        'hover:text-white',
      ],
    },
    {
      layout: 'calendar-day',
      active: 'true',
      class: [
        'bg-brand-300',
        'font-bold',
        'text-white',
      ],
    },
    {
      layout: 'calendar-day',
      highlighted: 'true',
      active: 'false',
      class: [
        'bg-brand-600/25',
        'font-bold',
        'text-brand-300',
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
        'bg-brand-300',
        'text-page',
        'hover:text-page',
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
