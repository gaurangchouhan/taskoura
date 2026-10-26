import { NavigateFunction } from 'react-router-dom';

/**
 * Handles smooth scrolling to in-page anchor sections.
 * If not currently on the landing page ('/'), navigates to '/' first, then scrolls.
 */
export function scrollToSection(
  sectionIdOrHref: string,
  navigate?: NavigateFunction,
  currentPathname?: string
): void {
  const targetId = sectionIdOrHref.replace(/^\/?#/, '');

  if (typeof window !== 'undefined') {
    // Notify any listening components (e.g., FeatureSection tabs)
    window.dispatchEvent(new CustomEvent('switch-feature-tab', { detail: targetId }));
  }

  const performScroll = () => {
    if (typeof window === 'undefined') return;
    try {
      window.history.pushState(null, '', `#${targetId}`);
    } catch {
      // In mock/test environments
    }

    const specificEl = document.getElementById(targetId);
    const featuresEl = document.getElementById('features');

    // If specific element exists and is rendered/visible, scroll to it;
    // otherwise fallback to parent features container
    if (specificEl && specificEl.offsetParent !== null) {
      specificEl.scrollIntoView({ behavior: 'smooth' });
    } else if (featuresEl) {
      featuresEl.scrollIntoView({ behavior: 'smooth' });
    } else if (specificEl) {
      specificEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (currentPathname && currentPathname !== '/') {
    if (navigate) {
      navigate(`/#${targetId}`);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/#${targetId}`;
    }
    setTimeout(performScroll, 120);
    return;
  }

  // Already on landing page:
  // Immediate scroll attempt for instant response and test environment compatibility
  const immediateTarget = document.getElementById(targetId) || document.getElementById('features');
  if (immediateTarget) {
    immediateTarget.scrollIntoView({ behavior: 'smooth' });
  }

  // Follow-up scroll after React batching unhides the tab panel
  setTimeout(performScroll, 50);
}
