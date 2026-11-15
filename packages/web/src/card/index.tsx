import { createSignal } from 'solid-js';
import type {
  Accessor,
  JSX,
} from 'solid-js';
import { render } from 'solid-js/web';
import { setTransport } from '@/api/transport';
import cardCss from '@/card/card.css?inline';
import { haTransport } from '@/card/haTransport';
import type { HassConnection } from '@/card/haTransport';
import { Snackbars } from '@/components/ui/Snackbars';
import { PortalMount } from '@/lib/portal';
import { TasksPage } from '@/pages/TasksPage';
import { LiveProvider } from '@/stores/live';
import { NotificationsProvider } from '@/stores/notifications';
import { SessionProvider } from '@/stores/session';
import { TagsProvider } from '@/stores/tags';
import { TasksProvider } from '@/stores/tasks';
import { themeElement } from '@/stores/theme';
import { twc } from '@/styles/twc';

type Hass = {
  connection: HassConnection;
  themes?: { darkMode?: boolean };
};

type CardConfig = {
  theme?: string;
  config_entry_id?: string;
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(cardCss);

function hoistDocumentRules(): void {
  const global = new CSSStyleSheet();
  [...sheet.cssRules]
    .filter((rule) => rule instanceof CSSFontFaceRule || rule.constructor.name === 'CSSPropertyRule')
    .forEach((rule) => global.insertRule(
      rule.cssText,
      global.cssRules.length,
    ));
  document.adoptedStyleSheets = [
    ...document.adoptedStyleSheets,
    global,
  ];
}

hoistDocumentRules();

const Notice = twc(
  'div',
  [
    'm-4',
    'rounded-md',
    'bg-well',
    'px-4',
    'py-3',
    'text-sm',
    'text-ink',
  ],
);

function notice() {
  return (
    <Notice role="status">
      Only one Karotto card works per view. This one stays off while another is showing; put it in a view of its own.
    </Notice>
  );
}

function board(mount: Node) {
  return (
    <PortalMount.Provider value={mount}>
      <NotificationsProvider>
        <SessionProvider
          syncTimezone={false}
          exchangeHashToken={false}
        >
          <Snackbars />
          <TagsProvider>
            <TasksProvider>
              <LiveProvider>
                <TasksPage display />
              </LiveProvider>
            </TasksProvider>
          </TagsProvider>
        </SessionProvider>
      </NotificationsProvider>
    </PortalMount.Provider>
  );
}

const running = new Set<KarottoCard>();
const waiting = new Set<KarottoCard>();

class KarottoCard extends HTMLElement {
  private config: CardConfig = {};
  private readonly isDark: Accessor<boolean>;
  private readonly setDark: (dark: boolean) => void;
  private mount: HTMLDivElement | undefined;
  private stopTheme: (() => void) | undefined;
  private stopContent: (() => void) | undefined;
  private connected: (connection: HassConnection) => void = () => undefined;
  private readonly connection = new Promise<HassConnection>((resolve) => {
    this.connected = resolve;
  });

  constructor() {
    super();
    const [
      isDark,
      setDark,
    ] = createSignal(false);
    this.isDark = isDark;
    this.setDark = setDark;
  }

  setConfig(config: CardConfig): void {
    this.config = config;
  }

  set hass(hass: Hass) {
    this.connected(hass.connection);
    this.setDark(hass.themes?.darkMode === true);
  }

  connectedCallback(): void {
    if (this.mount) {
      return;
    }
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
    this.mount = document.createElement('div');
    shadow.replaceChildren(this.mount);
    this.stopTheme = themeElement(
      this,
      () => this.config.theme ?? 'carrot',
      () => (this.isDark() ? 'dark' : 'light'),
    );
    if (running.size === 0) {
      this.activate();
    } else {
      waiting.add(this);
      this.show(notice);
    }
  }

  disconnectedCallback(): void {
    this.stopContent?.();
    this.stopTheme?.();
    this.stopContent = undefined;
    this.stopTheme = undefined;
    this.mount = undefined;
    waiting.delete(this);
    if (running.delete(this)) {
      const [next] = waiting;
      if (next) {
        waiting.delete(next);
        next.activate();
      }
    }
  }

  /** The app's stores share one transport per page, so only one card may run the board at a time. */
  private activate(): void {
    running.add(this);
    setTransport(haTransport(
      () => this.connection,
      this.config.config_entry_id,
    ));
    this.show(board);
  }

  private show(content: (mount: Node) => JSX.Element): void {
    const { mount } = this;
    if (!mount) {
      return;
    }
    this.stopContent?.();
    this.stopContent = render(
      () => content(mount),
      mount,
    );
  }

  getCardSize(): number {
    return 12;
  }

  getGridOptions() {
    return {
      columns: 'full',
      min_rows: 6,
    };
  }
}

customElements.define(
  'karotto-card',
  KarottoCard,
);

(window as { customCards?: unknown[] }).customCards ??= [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'karotto-card',
  name: 'Karotto',
  description: 'Habits, dailies and to-dos from Karotto',
});
