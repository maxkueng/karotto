/* @refresh reload */
import { render } from 'solid-js/web';
import { App } from '@/App';
import {
  applyHashTheme,
  initTheme,
} from '@/stores/theme';
import '@/index.css';

applyHashTheme();
initTheme();

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root');
}

render(
  () => <App />,
  root,
);
