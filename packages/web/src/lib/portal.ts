import { createContext } from 'solid-js';

/** Where modals mount; the document body unless an embedder keeps them inside its own shadow root. */
export const PortalMount = createContext<Node>(document.body);
