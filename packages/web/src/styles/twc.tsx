import { cva } from 'class-variance-authority';
import type {
  ComponentProps,
  JSX,
  ValidComponent,
} from 'solid-js';
import { splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { twMerge } from 'tailwind-merge';

type ClassValue = string | readonly string[];

type VariantConfig = {
  variants?: Record<string, Record<string, ClassValue | null>>;
  defaultVariants?: Record<string, string>;
};

const AnyDynamic = Dynamic as unknown as (
  props: Record<string, unknown> & { component: ValidComponent },
) => JSX.Element;

function normalizeVariants(values: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [
    key,
    value,
  ] of Object.entries(values)) {
    normalized[key] = typeof value === 'boolean' ? String(value) : value;
  }
  return normalized;
}

export function twc<
  T extends ValidComponent,
  const V extends VariantConfig = Record<string, never>,
>(
  element: T,
  base: ClassValue,
  config?: V & {
    defaultVariants?: V['variants'] extends Record<string, unknown>
      ? { [K in keyof V['variants']]?: keyof V['variants'][K] }
      : never;
  },
) {
  const style = cva(
    base as string,
    config as never,
  );
  const variantKeys = config?.variants ? Object.keys(config.variants) : [];

  type CvaVariants = V['variants'] extends Record<string, unknown>
    ? { [K in keyof V['variants']]?: keyof V['variants'][K] | boolean | null | undefined }
    : Record<string, never>;

  type Props = ComponentProps<T> & CvaVariants & { class?: string | undefined };

  return (props: Props) => {
    const [
      local,
      others,
    ] = splitProps(
      props,
      [
        ...variantKeys,
        'class',
      ] as never[],
    );

    return (
      <AnyDynamic
        component={element}
        {...(others as Record<string, unknown>)}
        class={twMerge(
          style(normalizeVariants(local as Record<string, unknown>) as never),
          (local as { class?: string }).class,
        )}
      />
    );
  };
}
