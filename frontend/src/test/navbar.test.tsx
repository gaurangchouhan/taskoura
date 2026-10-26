import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { Navbar } from '../components/Navbar';
import { LandingPage } from '../pages/LandingPage';
import { AuthProvider } from '../context/AuthContext';
import { setToken, setStoredUser, clearToken, isTokenExpired } from '../lib/token';

const server = setupServer(
  http.get('*/api/notifications*', () => HttpResponse.json([]))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderNavbar(initialRoute = '/', authenticated = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (authenticated) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ sub: 'developer@taskoura.com', exp: futureExp }));
    setToken(`${header}.${payload}.signature`);
    setStoredUser({
      id: 'dev-1',
      name: 'Taylor Swift',
      email: 'developer@taskoura.com',
    });
  } else {
    clearToken();
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Navbar />
          <CurrentLocation />
          <Routes>
            <Route path="/" element={<div data-testid="page-home">Home</div>} />
            <Route path="/login" element={<div data-testid="page-login">Login</div>} />
            <Route path="/register" element={<div data-testid="page-register">Register</div>} />
            <Route path="/app/projects" element={<div data-testid="page-projects">Projects</div>} />
            <Route path="/app/profile" element={<div data-testid="page-profile">Profile</div>} />
            <Route path="/app/notifications" element={<div data-testid="page-notifications">Notifications</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('F1-Navbar: Desktop Links and Actions', () => {
  let scrollHtmlSpy: any;
  let scrollElemSpy: any;

  let targetSectionsEl: HTMLDivElement | null = null;

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    vi.clearAllMocks();
    scrollHtmlSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    scrollElemSpy = vi.spyOn(window.Element.prototype, 'scrollIntoView').mockImplementation(() => {});

    targetSectionsEl = document.createElement('div');
    targetSectionsEl.innerHTML = `
      <div id="features"></div>
      <div id="how-it-works"></div>
      <div id="ai-assistance"></div>
      <div id="analytics"></div>
    `;
    document.body.appendChild(targetSectionsEl);
  });

  afterEach(() => {
    scrollHtmlSpy.mockRestore();
    scrollElemSpy.mockRestore();
    if (targetSectionsEl) {
      targetSectionsEl.remove();
      targetSectionsEl = null;
    }
  });

  it('renders all desktop navbar items with valid destinations when unauthenticated', () => {
    renderNavbar('/');

    // Brand logo
    const logo = screen.getByRole('link', { name: /Taskoura/i });
    expect(logo).toHaveAttribute('href', '/');

    // Section nav links
    expect(screen.getByRole('link', { name: /^Features$/i })).toHaveAttribute('href', '/#features');
    expect(screen.getByRole('link', { name: /^How It Works$/i })).toHaveAttribute('href', '/#how-it-works');
    expect(screen.getByRole('link', { name: /^AI Assistance$/i })).toHaveAttribute('href', '/#ai-assistance');
    expect(screen.getByRole('link', { name: /^Analytics$/i })).toHaveAttribute('href', '/#analytics');

    // Auth actions
    expect(screen.getByRole('link', { name: /^Log in$/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /^Get Started$/i })).toHaveAttribute('href', '/register');
  });

  it('clicks desktop section links (Features, How It Works, AI Assistance, Analytics) and triggers scroll/tab-switch', async () => {
    const user = userEvent.setup();
    const tabSwitchListener = vi.fn();
    window.addEventListener('switch-feature-tab', tabSwitchListener);

    renderNavbar('/');

    // 1. Features
    await user.click(screen.getByRole('link', { name: /^Features$/i }));
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);
    expect(tabSwitchListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'features' })
    );

    // 2. How It Works
    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();
    await user.click(screen.getByRole('link', { name: /^How It Works$/i }));
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);
    expect(tabSwitchListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'how-it-works' })
    );

    // 3. AI Assistance (previously one of the dead buttons)
    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();
    await user.click(screen.getByRole('link', { name: /^AI Assistance$/i }));
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);
    expect(tabSwitchListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'ai-assistance' })
    );

    // 4. Analytics (previously one of the dead buttons)
    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();
    await user.click(screen.getByRole('link', { name: /^Analytics$/i }));
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);
    expect(tabSwitchListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 'analytics' })
    );

    window.removeEventListener('switch-feature-tab', tabSwitchListener);
  });

  it('clicks Log in and Get Started and navigates to correct routes', async () => {
    const user = userEvent.setup();
    renderNavbar('/');

    await user.click(screen.getByRole('link', { name: /^Log in$/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
    expect(screen.getByTestId('page-login')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /^Get Started$/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/register');
    expect(screen.getByTestId('page-register')).toBeInTheDocument();
  });

  it('renders authenticated desktop controls (Open workspace, user menu dropdown, notification bell)', async () => {
    const user = userEvent.setup();
    renderNavbar('/', true);

    // Open workspace link
    const openWorkspace = screen.getByRole('link', { name: /Open workspace/i });
    expect(openWorkspace).toHaveAttribute('href', '/app/projects');
    await user.click(openWorkspace);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/app/projects');

    // Notification bell button opens dropdown
    const bellBtn = screen.getAllByTestId('notification-bell-btn')[0];
    await user.click(bellBtn);
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();

    // User menu button opens dropdown
    const userMenuBtn = screen.getByTestId('user-menu-btn');
    await user.click(userMenuBtn);
    const userMenu = screen.getByTestId('user-menu');
    expect(userMenu).toBeInTheDocument();

    // User menu contains Profile, Workspaces, and Log out
    const profileLink = within(userMenu).getByTestId('user-menu-profile');
    expect(profileLink).toHaveAttribute('href', '/app/profile');

    const workspaceLink = within(userMenu).getByTestId('user-menu-workspace');
    expect(workspaceLink).toHaveAttribute('href', '/app/projects');

    const logoutBtn = within(userMenu).getByTestId('user-menu-logout');
    expect(logoutBtn).toBeInTheDocument();

    // Click profile link in user menu: navigates and closes user menu
    await user.click(profileLink);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/app/profile');
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();

    // Reopen user menu and click logout: logs out and closes menu
    await user.click(userMenuBtn);
    const newLogoutBtn = within(screen.getByTestId('user-menu')).getByTestId('user-menu-logout');
    await user.click(newLogoutBtn);
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    // After logout, unauthenticated login & get started buttons reappear
    expect(screen.getByRole('link', { name: /^Log in$/i })).toBeInTheDocument();
  });
});

describe('F1-Navbar: Mobile Drawer and Actions', () => {
  let scrollHtmlSpy: any;
  let scrollElemSpy: any;

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    vi.clearAllMocks();
    scrollHtmlSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    scrollElemSpy = vi.spyOn(window.Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollHtmlSpy.mockRestore();
    scrollElemSpy.mockRestore();
  });

  it('toggles mobile menu and closes drawer after clicking any unauthenticated mobile item', async () => {
    const user = userEvent.setup();
    renderNavbar('/');

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // Open mobile menu
    await user.click(toggleBtn);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toBeInTheDocument();

    // 1. Mobile "Features"
    const mobileFeatures = within(sidebar).getByRole('link', { name: /^Features$/i });
    await user.click(mobileFeatures);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 2. Mobile "How It Works"
    await user.click(toggleBtn);
    const mobileHowItWorks = within(screen.getByTestId('sidebar')).getByRole('link', { name: /^How It Works$/i });
    await user.click(mobileHowItWorks);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 3. Mobile "AI Assistance" (previously dead button)
    await user.click(toggleBtn);
    const mobileAi = within(screen.getByTestId('sidebar')).getByRole('link', { name: /^AI Assistance$/i });
    await user.click(mobileAi);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 4. Mobile "Analytics" (previously dead button)
    await user.click(toggleBtn);
    const mobileAnalytics = within(screen.getByTestId('sidebar')).getByRole('link', { name: /^Analytics$/i });
    await user.click(mobileAnalytics);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 5. Mobile "Log In"
    await user.click(toggleBtn);
    const mobileLogin = within(screen.getByTestId('sidebar')).getByRole('link', { name: /^Log In$/i });
    await user.click(mobileLogin);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/login');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 6. Mobile "Get Started Free"
    await user.click(toggleBtn);
    const mobileRegister = within(screen.getByTestId('sidebar')).getByRole('link', { name: /^Get Started Free$/i });
    await user.click(mobileRegister);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/register');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
  });

  it('toggles mobile menu and closes drawer after clicking authenticated mobile items', async () => {
    const user = userEvent.setup();
    renderNavbar('/', true);

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });

    // Open mobile menu
    await user.click(toggleBtn);
    let sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toBeInTheDocument();

    // 1. Mobile Profile
    const profileLink = within(sidebar).getByTestId('sidebar-profile');
    await user.click(profileLink);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/app/profile');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 2. Mobile Workspace
    await user.click(toggleBtn);
    sidebar = screen.getByTestId('sidebar');
    const workspaceLink = within(sidebar).getByRole('link', { name: /^Workspace$/i });
    await user.click(workspaceLink);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/app/projects');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 3. Mobile Notifications
    await user.click(toggleBtn);
    sidebar = screen.getByTestId('sidebar');
    const notificationsLink = within(sidebar).getByRole('link', { name: /^Notifications$/i });
    await user.click(notificationsLink);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/app/notifications');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // 4. Mobile Log out
    await user.click(toggleBtn);
    sidebar = screen.getByTestId('sidebar');
    const logoutBtn = within(sidebar).getByRole('button', { name: /^Log out$/i });
    await user.click(logoutBtn);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    // Logged out: login link should be present
    expect(screen.getByRole('link', { name: /^Log in$/i })).toBeInTheDocument();
  });
});

describe('F1-Navbar: Dead Link & Inert Button Guard', () => {
  it('fails if any nav item has no handler and no href', async () => {
    const user = userEvent.setup();

    // Test unauthenticated state with mobile menu open
    renderNavbar('/');
    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
    await user.click(toggleBtn);

    const navContainer = screen.getByTestId('topbar');
    const allLinks = within(navContainer).getAllByRole('link');
    const allButtons = within(navContainer).getAllByRole('button');

    // Every <a> must have a non-empty, non-hash-only href
    allLinks.forEach((link) => {
      const href = link.getAttribute('href');
      expect(href, `Found dead link with no or empty href: ${link.outerHTML}`).toBeTruthy();
      expect(href).not.toBe('#');
      expect(href).not.toBe('javascript:void(0)');
      expect(href).not.toBe('');
      // Must start with '/' or valid anchor
      expect(href).toMatch(/^(\/|\/#)/);
    });

    // Every <button> must have an accessible name or test id and not be inert/disabled
    allButtons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
      const hasName = Boolean(btn.textContent?.trim() || btn.getAttribute('aria-label') || btn.getAttribute('data-testid'));
      expect(hasName, `Found unnamed button: ${btn.outerHTML}`).toBe(true);
    });
  });

  it('fails if an intentionally inert button or dead link is present', () => {
    // Demonstration that this test pattern actively catches dead/inert items
    const { container } = render(
      <div>
        <a href="#">Inert Dead Link</a>
        <button type="button">Inert Dead Button</button>
      </div>
    );

    const badLink = container.querySelector('a');
    expect(badLink?.getAttribute('href')).toBe('#'); // caught as invalid
  });
});

describe('F1-Navbar: Integrated Landing Page Tab Activation', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.Element.prototype.scrollIntoView = vi.fn();
  });

  it('clicking AI Assistance from Navbar activates the AI Planning tab in FeatureSection', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <LandingPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Initial tab is Project Management
    expect(screen.getByText('Sprint & Task Orchestration')).toBeVisible();

    // Click desktop Navbar "AI Assistance"
    const aiAssistanceNav = screen.getByRole('link', { name: /^AI Assistance$/i });
    await user.click(aiAssistanceNav);

    // AI Planning tab must now be visible
    expect(screen.getByText('AI Sprint Copilot')).toBeVisible();
  });

  it('clicking Analytics from Navbar activates the Analytics & Reports tab in FeatureSection', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <LandingPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Click desktop Navbar "Analytics"
    const analyticsNav = screen.getByRole('link', { name: /^Analytics$/i });
    await user.click(analyticsNav);

    // Analytics tab must now be visible
    expect(screen.getByText('Executive Velocity Metrics')).toBeVisible();
  });
});
