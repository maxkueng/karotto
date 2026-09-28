import MarkdownIt from 'markdown-it';
import { full as emoji } from 'markdown-it-emoji';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
}).use(emoji);

const defaultLinkOpen = md.renderer.rules.link_open ?? ((
  tokens,
  index,
  options,
  _env,
  self,
) => self.renderToken(
  tokens,
  index,
  options,
));

md.renderer.rules.link_open = (
  tokens,
  index,
  options,
  env,
  self,
) => {
  const token = tokens[index];
  token?.attrSet(
    'target',
    '_blank',
  );
  token?.attrSet(
    'rel',
    'noopener noreferrer',
  );
  return defaultLinkOpen(
    tokens,
    index,
    options,
    env,
    self,
  );
};

md.renderer.rules.emoji = (
  tokens,
  index,
) => `<span class="emoji">${tokens[index]?.content ?? ''}</span>`;

const CACHE_LIMIT = 1000;
const cache = new Map<string, string>();

function cached(
  key: string,
  render: () => string,
): string {
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(
      key,
      hit,
    );
    return hit;
  }
  const html = render();
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(
    key,
    html,
  );
  return html;
}

export function renderMarkdown(source: string): string {
  return cached(
    `block:${source}`,
    () => md.render(source),
  );
}

export function renderInlineMarkdown(source: string): string {
  return cached(
    `inline:${source}`,
    () => md.renderInline(source),
  );
}
