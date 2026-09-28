import { For } from 'solid-js';
import { Button } from '@/components/ui/Button';
import type { ButtonEdge } from '@/components/ui/Button';
import { Row } from '@/components/ui/Layout';

type ToggleGroupProps<T extends string> = {
  options: { value: T;
    label: string; }[];
  selected: T[];
  onToggle: (value: T) => void;
};

export function ToggleGroup<T extends string>(props: ToggleGroupProps<T>) {
  const edge = (index: number): ButtonEdge => {
    const last = props.options.length - 1;
    if (last === 0) {
      return 'only';
    }
    if (index === 0) {
      return 'first';
    }
    return index === last ? 'last' : 'middle';
  };
  return (
    <Row role="group">
      <For each={props.options}>
        {(
          option,
          index,
        ) => (
          <Button
            layout="toggle"
            edge={edge(index())}
            active={props.selected.includes(option.value)}
            aria-pressed={props.selected.includes(option.value)}
            onClick={() => props.onToggle(option.value)}
          >
            {option.label}
          </Button>
        )}
      </For>
    </Row>
  );
}
