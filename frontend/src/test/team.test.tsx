import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, renderHook, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ProjectLayout } from '../pages/ProjectLayout';
import { TeamPage } from '../pages/TeamPage';
import { projectTabs } from '../components/projects/projectTabs';
import { setToken, setStoredUser, clearToken } from '../lib/token';
import { Project } from '../types/project';
import { ProjectMember, InviteMemberRequest, UpdateRoleRequest } from '../types/member';
import { useMemberMap } from '../hooks/useMembers';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const PROJECT_ID = 'proj-team-1';
const OWNER_USER_ID = 'user-owner-1';
const MEMBER_USER_ID = 'user-member-2';

let mockProjects: Project[] = [];
let mockMembers: ProjectMember[] = [];
let lastInvitePayload: InviteMemberRequest | null = null;
let lastUpdateRolePayload: UpdateRoleRequest | null = null;
let lastRemovedUserId: string | null = null;

const server = setupServer(
  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  http.get('*/api/projects/:id', ({ params }) => {
    const found = mockProjects.find((p) => p.id === params.id);
    if (!found) return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    return HttpResponse.json(found);
  }),

  http.get('*/api/projects/:id/members', () => {
    return HttpResponse.json(mockMembers);
  }),

  http.post('*/api/projects/:id/members', async ({ request }) => {
    const body = (await request.json()) as InviteMemberRequest;
    lastInvitePayload = body;

    if (body.email === 'notfound@example.com') {
      return HttpResponse.json(
        { error: 'Not Found', message: 'User with this email not found', status: 404 },
        { status: 404 }
      );
    }

    if (mockMembers.some((m) => m.userEmail.toLowerCase() === body.email.toLowerCase())) {
      return HttpResponse.json(
        { error: 'Conflict', message: 'User is already a member of this project', status: 409 },
        { status: 409 }
      );
    }

    const newMember: ProjectMember = {
      id: `member-${Date.now()}`,
      userId: `user-${Date.now()}`,
      userName: body.email.split('@')[0],
      userEmail: body.email,
      role: body.role || 'Member',
    };
    mockMembers.push(newMember);
    return HttpResponse.json(newMember, { status: 201 });
  }),

  http.put('*/api/projects/:id/members/:userId', async ({ params, request }) => {
    const body = (await request.json()) as UpdateRoleRequest;
    lastUpdateRolePayload = body;
    const member = mockMembers.find((m) => m.userId === params.userId);
    if (!member) {
      return HttpResponse.json({ message: 'Membership not found' }, { status: 404 });
    }
    member.role = body.role;
    return HttpResponse.json(member, { status: 200 });
  }),

  http.delete('*/api/projects/:id/members/:userId', ({ params }) => {
    lastRemovedUserId = params.userId as string;
    mockMembers = mockMembers.filter((m) => m.userId !== params.userId);
    return new HttpResponse(null, { status: 204 });
  })
);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  return { queryClient, Wrapper };
};

const renderTeamPage = (initialRoute: string = `/app/projects/${PROJECT_ID}/team`) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
                <Route path="team" element={<TeamPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
};

describe('MODULE R5: Team tab & Project Member Management', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    lastInvitePayload = null;
    lastUpdateRolePayload = null;
    lastRemovedUserId = null;

    mockProjects = [
      {
        id: PROJECT_ID,
        name: 'HyperScale Engine',
        description: 'Team management test workspace',
        ownerId: OWNER_USER_ID,
        role: 'Owner',
      },
    ];

    mockMembers = [
      {
        id: 'member-1',
        userId: OWNER_USER_ID,
        userName: 'Alice Owner',
        userEmail: 'alice@example.com',
        role: 'Owner',
      },
      {
        id: 'member-2',
        userId: MEMBER_USER_ID,
        userName: 'Bob Member',
        userEmail: 'bob@example.com',
        role: 'Member',
      },
    ];
  });

  it('projectTabs: registers team tab correctly with path and element', () => {
    expect(projectTabs).toBeDefined();
    expect(projectTabs[0].key).toBe('board');
    const teamTab = projectTabs.find((t) => t.key === 'team');
    expect(teamTab).toBeDefined();
    expect(teamTab?.label).toBe('Team');
    expect(teamTab?.path).toBe('team');
  });

  it('Owner sees controls, member does not: shows invite form and member controls only to Owner', async () => {
    // 1. As Owner
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: OWNER_USER_ID, exp: validFuture }));
    setStoredUser({ id: OWNER_USER_ID, name: 'Alice Owner', email: 'alice@example.com' });

    const { unmount } = renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
      expect(screen.getByText('Bob Member')).toBeInTheDocument();
    });

    // Owner sees Invite card and button
    expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

    // Owner sees Change role and Remove buttons
    expect(screen.getAllByRole('button', { name: /change role/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /remove/i }).length).toBeGreaterThan(0);

    // Current user's row shows "You"
    const youBadges = screen.getAllByTestId('you-badge');
    expect(youBadges.length).toBe(1);
    expect(youBadges[0]).toHaveTextContent('You');

    unmount();

    // 2. As non-owner (Member)
    clearToken();
    setToken(createJwt({ sub: MEMBER_USER_ID, exp: validFuture }));
    setStoredUser({ id: MEMBER_USER_ID, name: 'Bob Member', email: 'bob@example.com' });

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
      expect(screen.getByText('Bob Member')).toBeInTheDocument();
    });

    // Non-owner does NOT see invite form or invite button
    expect(screen.queryByText('Invite Team Member')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument();

    // Non-owner does NOT see management controls
    expect(screen.queryByRole('button', { name: /change role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-menu-btn')).not.toBeInTheDocument();

    // Current user's row shows "You" for Bob
    const memberYouBadges = screen.getAllByTestId('you-badge');
    expect(memberYouBadges.length).toBe(1);
    expect(memberYouBadges[0]).toHaveTextContent('You');
  });

  it('Invite success: owner can invite a new member with role selection', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: OWNER_USER_ID, exp: validFuture }));
    setStoredUser({ id: OWNER_USER_ID, name: 'Alice Owner', email: 'alice@example.com' });

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const emailInput = screen.getByLabelText(/email address/i);
    const roleSelect = screen.getByLabelText(/role/i);
    const inviteButton = screen.getByRole('button', { name: /invite/i });

    // Role select contains only Member and Owner
    const options = screen.getAllByRole('option');
    const optionValues = options.map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toEqual(['Member', 'Owner']);

    await user.type(emailInput, 'charlie@example.com');
    await user.selectOptions(roleSelect, 'Member');
    await user.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByText('charlie@example.com')).toBeInTheDocument();
    });

    expect(lastInvitePayload).toEqual({
      email: 'charlie@example.com',
      role: 'Member',
    });
  });

  it('Invite errors: displays "No user found with this email" and "This person is already on the team"', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: OWNER_USER_ID, exp: validFuture }));
    setStoredUser({ id: OWNER_USER_ID, name: 'Alice Owner', email: 'alice@example.com' });

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const emailInput = screen.getByLabelText(/email address/i);
    const inviteButton = screen.getByRole('button', { name: /invite/i });

    // 1. User not found (404)
    await user.type(emailInput, 'notfound@example.com');
    await user.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByTestId('invite-error')).toHaveTextContent('No user found with this email');
      expect(screen.getByText('No user found with this email')).toBeInTheDocument();
    });

    // 2. Already member (409)
    await user.clear(emailInput);
    await user.type(emailInput, 'alice@example.com');
    await user.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByTestId('invite-error')).toHaveTextContent('This person is already on the team');
      expect(screen.getByText('This person is already on the team')).toBeInTheDocument();
    });
  });

  it('Role change and removal: owner can change member role and remove member with confirm dialog', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: OWNER_USER_ID, exp: validFuture }));
    setStoredUser({ id: OWNER_USER_ID, name: 'Alice Owner', email: 'alice@example.com' });

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Bob Member')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // 1. Change role for Bob
    const bobRow = screen.getByTestId(`member-row-${MEMBER_USER_ID}`);
    const changeRoleBtn = within(bobRow).getByRole('button', { name: /change role/i });
    await user.click(changeRoleBtn);

    // Role modal opens
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/change member role/i)).toBeInTheDocument();

    const roleSelect = screen.getByLabelText(/select role/i);
    await user.selectOptions(roleSelect, 'Owner');
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => {
      expect(lastUpdateRolePayload).toEqual({ role: 'Owner' });
    });

    // 2. Removal with confirm dialog
    const removeBtn = within(bobRow).getByRole('button', { name: /remove/i });
    await user.click(removeBtn);

    // Modal dialog appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/remove team member/i)).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();

    // Confirm removal
    await user.click(screen.getByRole('button', { name: /confirm remove/i }));

    await waitFor(() => {
      expect(lastRemovedUserId).toBe(MEMBER_USER_ID);
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    });
  });

  it('Last-Owner removal blocked: prevents removing yourself and the last Owner with explanation', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: OWNER_USER_ID, exp: validFuture }));
    setStoredUser({ id: OWNER_USER_ID, name: 'Alice Owner', email: 'alice@example.com' });

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    });

    // Alice is the only owner and also the current user
    const aliceRow = screen.getByTestId(`member-row-${OWNER_USER_ID}`);
    const aliceRemoveBtn = aliceRow.querySelector('button[title*="remove"], button:disabled');

    expect(aliceRemoveBtn).toBeDisabled();

    // Explanations present
    expect(
      screen.getByText(/cannot remove the last owner|you cannot remove yourself/i)
    ).toBeInTheDocument();

    // If modal is opened, it explains the block and does not allow deletion
    fireEvent.click(aliceRemoveBtn!);
    expect(screen.queryByRole('button', { name: /confirm remove/i })).not.toBeInTheDocument();
  });

  it('useMemberMap resolves names: exported hook maps userId to member details', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useMemberMap(PROJECT_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });

    const alice = result.current.get(OWNER_USER_ID);
    expect(alice).toBeDefined();
    expect(alice?.userName).toBe('Alice Owner');
    expect(alice?.userEmail).toBe('alice@example.com');
    expect(alice?.role).toBe('Owner');

    const bob = result.current.get(MEMBER_USER_ID);
    expect(bob).toBeDefined();
    expect(bob?.userName).toBe('Bob Member');
    expect(bob?.userEmail).toBe('bob@example.com');
    expect(bob?.role).toBe('Member');

    // Unknown user resolves to undefined
    expect(result.current.get('unknown-user-id')).toBeUndefined();
  });

  it('Manual flow end-to-end: invite second account, change role, remove it, unregistered email, and duplicate invite', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: OWNER_USER_ID, exp: validFuture }));
    setStoredUser({ id: OWNER_USER_ID, name: 'Alice Owner', email: 'alice@example.com' });

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const emailInput = screen.getByLabelText(/email address/i);
    const roleSelect = screen.getByLabelText(/role/i);
    const inviteButton = screen.getByRole('button', { name: /invite/i });

    // 1. Try inviting unregistered email -> shows error
    await user.type(emailInput, 'notfound@example.com');
    await user.click(inviteButton);
    expect(await screen.findByText('No user found with this email')).toBeInTheDocument();

    // 2. Try inviting already existing member -> shows error
    await user.clear(emailInput);
    await user.type(emailInput, 'alice@example.com');
    await user.click(inviteButton);
    expect(await screen.findByText('This person is already on the team')).toBeInTheDocument();

    // 3. Invite a second account (Dave)
    await user.clear(emailInput);
    await user.type(emailInput, 'dave@example.com');
    await user.selectOptions(roleSelect, 'Member');
    await user.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByText('dave@example.com')).toBeInTheDocument();
    });

    // 4. Try inviting Dave a second time -> shows already on the team
    await user.clear(emailInput);
    await user.type(emailInput, 'dave@example.com');
    await user.click(inviteButton);
    expect(await screen.findByText('This person is already on the team')).toBeInTheDocument();

    // 5. Change Dave's role to Owner
    const daveMember = mockMembers.find((m) => m.userEmail === 'dave@example.com')!;
    const daveRow = screen.getByTestId(`member-row-${daveMember.userId}`);
    const changeRoleBtn = within(daveRow).getByRole('button', { name: /change role/i });
    await user.click(changeRoleBtn);

    const changeRoleSelect = screen.getByLabelText(/select role/i);
    await user.selectOptions(changeRoleSelect, 'Owner');
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => {
      expect(lastUpdateRolePayload).toEqual({ role: 'Owner' });
    });

    // 6. Remove Dave from team
    const removeDaveBtn = within(daveRow).getByRole('button', { name: /remove/i });
    await user.click(removeDaveBtn);

    expect(await screen.findByText(/remove team member/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm remove/i }));

    await waitFor(() => {
      expect(lastRemovedUserId).toBe(daveMember.userId);
      expect(screen.queryByText('dave@example.com')).not.toBeInTheDocument();
    });
  });
});
