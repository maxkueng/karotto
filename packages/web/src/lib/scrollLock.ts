let holders = 0;
let restore: (() => void) | undefined;

/** Hides the page scrollbar while a modal is open, padding for its width so nothing shifts. Nestable. */
export function lockScroll(): () => void {
  if (holders === 0) {
    const root = document.documentElement;
    const gutter = window.innerWidth - root.clientWidth;
    const previous = {
      overflow: root.style.overflow,
      paddingRight: root.style.paddingRight,
    };
    root.style.overflow = 'hidden';
    if (gutter > 0) {
      root.style.paddingRight = `${gutter}px`;
    }
    restore = () => {
      root.style.overflow = previous.overflow;
      root.style.paddingRight = previous.paddingRight;
    };
  }
  holders += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    holders -= 1;
    if (holders === 0) {
      restore?.();
      restore = undefined;
    }
  };
}
