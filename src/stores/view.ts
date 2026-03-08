import { writable, get } from 'svelte/store';
import { activeShareCode } from './share';

export type View = 'search' | 'about' | 'decks' | 'deckbuilder' | 'shared' | 'scan';

export const activeView = writable<View>('search');
export const activeDeckId = writable<string | null>(null);

/** Map a URL path to a view + optional deck ID */
function pathToView(path: string): { view: View; deckId?: string; shareCode?: string } {
  if (path === '/' || path === '/collection') return { view: 'search' };
  if (path === '/scan') return { view: 'scan' };
  if (path === '/decks') return { view: 'decks' };
  if (path === '/about') return { view: 'about' };

  const deckMatch = path.match(/^\/decks\/(.+)$/);
  if (deckMatch) return { view: 'deckbuilder', deckId: deckMatch[1] };

  const shareMatch = path.match(/^\/share\/([a-zA-Z0-9]{8})$/);
  if (shareMatch) return { view: 'shared', shareCode: shareMatch[1] };

  return { view: 'search' };
}

/** Map a view + optional deck ID to a URL path */
function viewToPath(view: View, deckId?: string | null): string {
  switch (view) {
    case 'search': return '/';
    case 'scan': return '/scan';
    case 'decks': return '/decks';
    case 'deckbuilder': return deckId ? `/decks/${deckId}` : '/decks';
    case 'about': return '/about';
    case 'shared': return `/share/${get(activeShareCode) || ''}`;
    default: return '/';
  }
}

/** Navigate to a view, updating both store and URL */
export function navigateTo(view: View, deckId?: string | null) {
  activeView.set(view);
  if (view === 'deckbuilder' && deckId) {
    activeDeckId.set(deckId);
  } else if (view !== 'deckbuilder') {
    activeDeckId.set(null);
  }

  const path = viewToPath(view, deckId);
  if (window.location.pathname !== path) {
    history.pushState({ view, deckId: deckId || null }, '', path);
  }
}

/** Initialize router: read current URL and listen for popstate */
export function initRouter() {
  // Read initial URL
  const { view, deckId, shareCode } = pathToView(window.location.pathname);
  activeView.set(view);
  if (deckId) activeDeckId.set(deckId);
  if (shareCode) activeShareCode.set(shareCode);

  // Replace current history entry with state
  history.replaceState({ view, deckId: deckId || null }, '', window.location.pathname);

  // Handle browser back/forward
  window.addEventListener('popstate', (event) => {
    if (event.state?.view) {
      activeView.set(event.state.view);
      activeDeckId.set(event.state.deckId || null);
    } else {
      // Fallback: parse URL
      const result = pathToView(window.location.pathname);
      activeView.set(result.view);
      activeDeckId.set(result.deckId || null);
      if (result.shareCode) activeShareCode.set(result.shareCode);
    }
  });
}
