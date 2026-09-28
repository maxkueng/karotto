import { A } from '@solidjs/router';
import LogOut from 'lucide-solid/icons/log-out';
import Settings from 'lucide-solid/icons/settings';
import logo from '@/assets/logo.svg';
import { Button } from '@/components/ui/Button';
import { Caret } from '@/components/ui/Caret';
import { Row } from '@/components/ui/Layout';
import { Menu } from '@/components/ui/Menu';
import { useNotifications } from '@/stores/notifications';
import { useSession } from '@/stores/session';
import { twc } from '@/styles/twc';

const TopBar = twc(
  'header',
  [
    'z-[1080]',
    'min-h-14',
    'bg-purple-100',
    'shadow-nav',
  ],
);

const TopBarInner = twc(
  Row,
  [
    'mx-auto',
    'h-14',
    'max-w-[1200px]',
    'px-3',
  ],
);

const Brand = twc(
  A,
  [
    'mr-3',
    'flex',
    'items-center',
    'gap-2',
    'pl-2',
    'font-condensed',
    'text-[20px]',
    'font-bold',
    'text-white',
    'hover:no-underline',
  ],
);

const RightSide = twc(
  'div',
  ['ml-auto'],
);

const activeLinkClass = 'shadow-[inset_0_-4px_0_var(--color-purple-300)]';

export function Navbar() {
  const session = useSession();
  const notifications = useNotifications();

  return (
    <TopBar>
      <TopBarInner>
        <Brand href="/">
          <img
            src={logo}
            alt=""
            width={32}
            height={32}
          />
          karotto
        </Brand>
        <Row>
          <Button
            renderAs="link"
            layout="nav-link"
            href="/"
            end
            activeClass={activeLinkClass}
          >
            Tasks
          </Button>
          <Button
            renderAs="link"
            layout="nav-link"
            href="/settings"
            activeClass={activeLinkClass}
          >
            Settings
          </Button>
        </Row>
        <RightSide>
          <Menu trigger={() => (
            <Button
              layout="nav"
              iconRight={<Caret tone="purple" />}
            >
              {session.user()?.username}
            </Button>
          )}
          >
            {(close) => (
              <>
                <Button
                  renderAs="link"
                  layout="list"
                  href="/settings"
                  icon={<Settings size={16} />}
                  onClick={close}
                >
                  Settings
                </Button>
                <Button
                  layout="list"
                  icon={<LogOut size={16} />}
                  onClick={() => {
                    close();
                    session.logout().catch(notifications.error);
                  }}
                >
                  Log out
                </Button>
              </>
            )}
          </Menu>
        </RightSide>
      </TopBarInner>
    </TopBar>
  );
}
