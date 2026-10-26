import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from '../pages/LandingPage';
import { Navbar } from '../components/Navbar';
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  decodeToken,
  isTokenExpired,
} from '../lib/token';

describe('Landing Page Links and Destinations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders landing page with correct href destinations for all main buttons and links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // 1. Logo -> /
    const logoLink = screen.getByRole('link', { name: /Taskoura/i });
    expect(logoLink).toHaveAttribute('href', '/');

    // 2. Navbar buttons (unauthenticated by default)
    // Desktop "Log in" and "Get Started"
    const loginLinks = screen.getAllByRole('link', { name: /^log in$/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute('href', '/login');

    const getStartedLinks = screen.getAllByRole('link', { name: /get started/i });
    expect(getStartedLinks.length).toBeGreaterThan(0);
    expect(getStartedLinks[0]).toHaveAttribute('href', '/register');

    // 3. CTA strip buttons: "Create Free Project" and "Sign In to Workspace"
    const createFreeProject = screen.getByRole('link', { name: /create free project/i });
    expect(createFreeProject).toHaveAttribute('href', '/register');

    const signInWorkspace = screen.getByRole('link', { name: /sign in to workspace/i });
    expect(signInWorkspace).toHaveAttribute('href', '/login');

    // 4. Footer links: "User Sign In", "Create Account", "Active Projects"
    const userSignIn = screen.getByRole('link', { name: /user sign in/i });
    expect(userSignIn).toHaveAttribute('href', '/login');

    const createAccount = screen.getByRole('link', { name: /create account/i });
    expect(createAccount).toHaveAttribute('href', '/register');

    const activeProjects = screen.getByRole('link', { name: /active projects/i });
    expect(activeProjects).toHaveAttribute('href', '/app/projects');
  });

  it('triggers smooth-scroll on Navbar section anchor clicks', async () => {
    const user = userEvent.setup();
    const scrollHtmlSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const scrollElemSpy = vi.spyOn(window.Element.prototype, 'scrollIntoView').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // Navbar items: Features, How It Works, AI Assistance, Analytics
    const featuresAnchor = screen.getByRole('link', { name: /^Features$/i });
    await user.click(featuresAnchor);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();

    const howItWorksAnchor = screen.getAllByRole('link', { name: /^How It Works$/i })[0];
    await user.click(howItWorksAnchor);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();

    const aiAssistanceAnchor = screen.getByRole('link', { name: /^AI Assistance$/i });
    await user.click(aiAssistanceAnchor);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();

    const analyticsAnchor = screen.getByRole('link', { name: /^Analytics$/i });
    await user.click(analyticsAnchor);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockRestore();
    scrollElemSpy.mockRestore();
  });

  it('triggers smooth-scroll on Footer platform links', async () => {
    const user = userEvent.setup();
    const scrollHtmlSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const scrollElemSpy = vi.spyOn(window.Element.prototype, 'scrollIntoView').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    const footer = screen.getByRole('contentinfo');

    const footerHowItWorks = within(footer).getByRole('link', { name: /^How It Works$/i });
    await user.click(footerHowItWorks);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();

    const footerKanban = within(footer).getByRole('link', { name: /Sprint Kanban Board/i });
    await user.click(footerKanban);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();

    const footerAi = within(footer).getByRole('link', { name: /AI Task Generation/i });
    await user.click(footerAi);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockClear();
    scrollElemSpy.mockClear();

    const footerQa = within(footer).getByRole('link', { name: /QA & Test Cases/i });
    await user.click(footerQa);
    expect(scrollHtmlSpy.mock.calls.length + scrollElemSpy.mock.calls.length).toBeGreaterThan(0);

    scrollHtmlSpy.mockRestore();
    scrollElemSpy.mockRestore();
  });
});

describe('Engineered for Modern Development Tabs', () => {
  it('switches tab content when each tab button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // Initial tab: Project Management is active
    expect(screen.getByText('Sprint & Task Orchestration')).toBeVisible();

    // Switch to QA & Defect Tracking
    const qaTabBtn = screen.getByRole('button', { name: /QA & Defect Tracking/i });
    await user.click(qaTabBtn);
    expect(screen.getByText('Quality Assurance & Bug Management')).toBeVisible();

    // Switch to AI Planning
    const aiTabBtn = screen.getByRole('button', { name: /AI Planning/i });
    await user.click(aiTabBtn);
    expect(screen.getByText('AI Sprint Copilot')).toBeVisible();

    // Switch to Analytics & Reports
    const analyticsTabBtn = screen.getByRole('button', { name: /Analytics & Reports/i });
    await user.click(analyticsTabBtn);
    expect(screen.getByText('Executive Velocity Metrics')).toBeVisible();

    // Switch back to Project Management
    const workflowTabBtn = screen.getByRole('button', { name: /Project Management/i });
    await user.click(workflowTabBtn);
    expect(screen.getByText('Sprint & Task Orchestration')).toBeVisible();
  });
});

describe('Navbar Token and Authentication State', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders "Log in" and "Get Started" without a token', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open workspace/i })).not.toBeInTheDocument();
  });

  it('renders "Open workspace" linking to /app/projects with a valid unexpired token', () => {
    // Generate valid unexpired token (exp in 1 hour)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ sub: 'user@taskoura.com', exp: futureExp }));
    const token = `${header}.${payload}.signature`;

    setToken(token);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Navbar />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const openWorkspace = screen.getByRole('link', { name: /open workspace/i });
    expect(openWorkspace).toBeInTheDocument();
    expect(openWorkspace).toHaveAttribute('href', '/app/projects');
    expect(screen.queryByRole('link', { name: /^log in$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
  });

  it('renders "Log in" and "Get Started" when token is expired', () => {
    // Generate expired token (exp in past)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const payload = btoa(JSON.stringify({ sub: 'user@taskoura.com', exp: pastExp }));
    const token = `${header}.${payload}.signature`;

    setToken(token);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open workspace/i })).not.toBeInTheDocument();
  });
});

describe('Token Utility Functions (src/lib/token.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('manages taskoura_token and taskoura_user in localStorage', () => {
    expect(getToken()).toBeNull();
    setToken('sample-jwt-token');
    expect(getToken()).toBe('sample-jwt-token');
    expect(localStorage.getItem('taskoura_token')).toBe('sample-jwt-token');

    const sampleUser = { id: '1', email: 'test@taskoura.com', name: 'Test User' };
    setStoredUser(sampleUser);
    expect(getStoredUser()).toEqual(sampleUser);

    clearToken();
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('correctly decodes token and detects expiration', () => {
    expect(decodeToken(null)).toBeNull();
    expect(isTokenExpired()).toBe(true);

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const futureExp = Math.floor(Date.now() / 1000) + 1200;
    const payload = btoa(JSON.stringify({ sub: 'user@taskoura.com', exp: futureExp }));
    const validToken = `${header}.${payload}.signature`;

    setToken(validToken);
    expect(isTokenExpired()).toBe(false);
    expect(decodeToken(validToken)?.sub).toBe('user@taskoura.com');

    // Expired token
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const expiredPayload = btoa(JSON.stringify({ sub: 'user@taskoura.com', exp: pastExp }));
    const expiredToken = `${header}.${expiredPayload}.signature`;

    setToken(expiredToken);
    expect(isTokenExpired()).toBe(true);
  });
});

describe('Text-Only Fixes Verification', () => {
  it('contains all 5 exact text-only string fixes and does not contain obsolete strings', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // 1. "Record your frontend, backend, database and testing stack for every project"
    expect(
      screen.getByText('Record your frontend, backend, database and testing stack for every project.')
    ).toBeInTheDocument();

    // 2. "Owner and Member" instead of "Owner, Admin, Member"
    expect(
      screen.getByText(
        'Role-based access controls (Owner and Member) with secure JWT authenticated sessions.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Owner, Admin, Member/i)).not.toBeInTheDocument();

    // 3. "Completion progress" instead of "Executive sprint velocity"
    expect(
      screen.getByText(
        'Completion progress, member contributions, and test pass/fail audits.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Executive sprint velocity/i)).not.toBeInTheDocument();

    // 4. "Testing" in Kanban copy instead of "Review"
    expect(
      screen.getByText(
        'Backlog, In Progress, Testing, and Completed stages with automated status logs.'
      )
    ).toBeInTheDocument();

    // 5. "Completed" in subtask demo card instead of "Passed"
    const completedBadges = screen.getAllByText('Completed');
    expect(completedBadges.length).toBeGreaterThan(0);
    // Ensure "Passed" is not used in subtask cards
    expect(screen.queryByText('Passed')).not.toBeInTheDocument();
  });
});
