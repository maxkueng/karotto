import type { ValidComponent } from 'solid-js';
import { createMemo } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  renderInlineMarkdown,
  renderMarkdown,
} from '@/lib/markdown';
import { twc } from '@/styles/twc';

export const MarkdownBody = twc(
  'div',
  ['markdown'],
);

type MarkdownProps = {
  source: string;
  inline?: boolean;
  as?: ValidComponent;
};

export function Markdown(props: MarkdownProps) {
  const html = createMemo(() => (props.inline ? renderInlineMarkdown(props.source) : renderMarkdown(props.source)));
  return (
    <Dynamic
      component={props.as ?? MarkdownBody}
      // eslint-disable-next-line solid/no-innerhtml -- markdown-it runs with html disabled, so the output is escaped
      innerHTML={html()}
    />
  );
}
