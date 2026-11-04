import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  User as UserIcon,
  Mail,
  CheckCircle2,
  Calendar,
  Save,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  Upload,
  Trash2,
  Briefcase,
  Building,
  GraduationCap,
  Globe,
  Github,
  Linkedin,
  FileText,
  Tag,
  Clock,
  Bell,
  Phone,
  Shield,
  ExternalLink,
  X,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmDialog } from '../../attachments/components/ConfirmDialog';
import { Navbar } from '../../../components/Navbar';
import {
  useMe,
  useOAuthProviders,
  useStartOAuthLink,
  useDisconnectProvider,
  useUpdateProfile,
  useUpdateProfileDetails,
  useUploadAvatar,
  useDeleteAvatar,
  profileQueryKeys,
} from '../hooks';
import { useAuth } from '../../../context/AuthContext';
import {
  formatDate as formatLocalDate,
  getBrowserTimeZone,
  useSetTimeZone,
  useTimeZone,
} from '../../../lib/datetime';
import { Avatar } from '../../../components/common/Avatar';
import { NotificationPrefs, UpdateProfileRequest } from '../../../types/profile';

// Curated list of standard IANA timezones
const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Dublin',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

function getInitials(name = ''): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  );
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  try {
    const formatted = formatLocalDate(dateStr, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return formatted || 'Recently';
  } catch {
    return 'Recently';
  }
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  taskAssigned: true,
  deadlineReminders: true,
  mentions: true,
  projectInvites: true,
  statusChanges: false,
};

const LINK_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_LINKED: 'This provider account is already connected to your profile.',
  IDENTITY_LINKED_TO_OTHER_ACCOUNT: 'This account is already linked to another Taskoura user.',
  ACCESS_DENIED: 'Connection request was cancelled or access was denied.',
  PROVIDER_ERROR: 'An error occurred with the authentication provider. Please try again.',
  LINK_EXPIRED: 'The account linking session expired. Please try connecting again.',
};

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { data: profileData, isLoading } = useMe();
  const queryClient = useQueryClient();
  const { data: providersData, isLoading: providersLoading } = useOAuthProviders();
  const startOAuthLinkMutation = useStartOAuthLink();
  const disconnectProviderMutation = useDisconnectProvider();
  const updateProfileMutation = useUpdateProfile();
  const updateProfileDetailsMutation = useUpdateProfileDetails();
  const uploadAvatarMutation = useUploadAvatar();
  const deleteAvatarMutation = useDeleteAvatar();
  const setContextTimeZone = useSetTimeZone();
  const activeContextTimeZone = useTimeZone();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Connected accounts UI state
  const [providerToDisconnect, setProviderToDisconnect] = useState<{ key: string; label: string } | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [lastLoginMethodError, setLastLoginMethodError] = useState<string | null>(null);
  const [linkErrorBanner, setLinkErrorBanner] = useState<string | null>(null);

  // Handle URL return parameters (?linked=<provider> or ?link_error=<CODE>)
  useEffect(() => {
    const linked = searchParams.get('linked');
    const linkError = searchParams.get('link_error');

    if (linked) {
      const providerName = linked.charAt(0).toUpperCase() + linked.slice(1);
      toast.success(`Successfully connected ${providerName}!`);
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    } else if (linkError) {
      const msg = LINK_ERROR_MESSAGES[linkError] || 'Failed to connect account. Please try again.';
      toast.error(msg);
      setLinkErrorBanner(msg);
    }

    if (linked || linkError) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('linked');
      nextParams.delete('link_error');
      setSearchParams(nextParams, { replace: true });
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const cleanUrl = window.location.pathname + (nextParams.toString() ? `?${nextParams.toString()}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [searchParams, setSearchParams, queryClient]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active user data
  const profile: any = profileData || user || {};

  // Form states
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(profile.profile?.phone || '');
  const [organization, setOrganization] = useState(profile.profile?.organization || '');
  const [department, setDepartment] = useState(profile.profile?.department || '');
  const [jobTitle, setJobTitle] = useState(profile.profile?.jobTitle || '');
  const [graduationYear, setGraduationYear] = useState<string>(
    profile.profile?.graduationYear != null ? String(profile.profile.graduationYear) : ''
  );
  const [githubUrl, setGithubUrl] = useState(profile.profile?.githubUrl || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile.profile?.linkedinUrl || '');
  const [bio, setBio] = useState(profile.profile?.bio || '');
  const [skills, setSkills] = useState<string[]>(profile.profile?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [timeZone, setTimeZone] = useState<string>(
    profile.profile?.timeZone || getBrowserTimeZone() || 'UTC'
  );
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    profile.profile?.notificationPrefs || DEFAULT_NOTIFICATION_PREFS
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile.profile?.avatarUrl ?? null
  );

  // Initial loaded snapshot for dirty checking
  const [initialSnapshot, setInitialSnapshot] = useState({
    name: profile.name || '',
    phone: profile.profile?.phone || '',
    organization: profile.profile?.organization || '',
    department: profile.profile?.department || '',
    jobTitle: profile.profile?.jobTitle || '',
    graduationYear:
      profile.profile?.graduationYear != null ? String(profile.profile.graduationYear) : '',
    githubUrl: profile.profile?.githubUrl || '',
    linkedinUrl: profile.profile?.linkedinUrl || '',
    bio: profile.profile?.bio || '',
    skills: profile.profile?.skills || [],
    timeZone: profile.profile?.timeZone || getBrowserTimeZone() || 'UTC',
    notificationPrefs: profile.profile?.notificationPrefs || DEFAULT_NOTIFICATION_PREFS,
  });

  // Keep state in sync when profile finishes loading
  useEffect(() => {
    if (profileData) {
      const newName = profileData.name || '';
      const p = profileData.profile || ({} as any);
      const newPhone = p.phone || '';
      const newOrg = p.organization || '';
      const newDept = p.department || '';
      const newJob = p.jobTitle || '';
      const newGrad = p.graduationYear != null ? String(p.graduationYear) : '';
      const newGithub = p.githubUrl || '';
      const newLinkedin = p.linkedinUrl || '';
      const newBio = p.bio || '';
      const newSkills = Array.isArray(p.skills) ? [...p.skills] : [];
      const newTz = p.timeZone || getBrowserTimeZone() || 'UTC';
      const newPrefs = p.notificationPrefs || DEFAULT_NOTIFICATION_PREFS;
      const newAvatar = p.avatarUrl ?? null;

      setName((prev: string) => (prev === initialSnapshot.name ? newName : prev));
      setPhone((prev: string) => (prev === initialSnapshot.phone ? newPhone : prev));
      setOrganization((prev: string) => (prev === initialSnapshot.organization ? newOrg : prev));
      setDepartment((prev: string) => (prev === initialSnapshot.department ? newDept : prev));
      setJobTitle((prev: string) => (prev === initialSnapshot.jobTitle ? newJob : prev));
      setGraduationYear((prev: string) => (prev === initialSnapshot.graduationYear ? newGrad : prev));
      setGithubUrl((prev: string) => (prev === initialSnapshot.githubUrl ? newGithub : prev));
      setLinkedinUrl((prev: string) => (prev === initialSnapshot.linkedinUrl ? newLinkedin : prev));
      setBio((prev: string) => (prev === initialSnapshot.bio ? newBio : prev));
      setSkills((prev: string[]) => (prev.length === 0 ? newSkills : prev));
      setTimeZone((prev: string) => (prev === initialSnapshot.timeZone ? newTz : prev));
      setAvatarUrl(newAvatar);

      setInitialSnapshot({
        name: newName,
        phone: newPhone,
        organization: newOrg,
        department: newDept,
        jobTitle: newJob,
        graduationYear: newGrad,
        githubUrl: newGithub,
        linkedinUrl: newLinkedin,
        bio: newBio,
        skills: newSkills,
        timeZone: newTz,
        notificationPrefs: newPrefs,
      });
    }
  }, [profileData]);

  // Sync avatarUrl if auth user avatar changes
  useEffect(() => {
    if (user?.avatarUrl && !avatarUrl) {
      setAvatarUrl(user.avatarUrl);
    }
  }, [user?.avatarUrl]);

  // Feedback states
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [pendingLeavePath, setPendingLeavePath] = useState<string | null>(null);

  // Timezones list: ensure current timeZone and browser timezone are included
  const availableTimeZones = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    const browserTz = getBrowserTimeZone();
    if (browserTz) set.add(browserTz);
    if (timeZone) set.add(timeZone);
    if (profile.profile?.timeZone) set.add(profile.profile.timeZone);
    return Array.from(set).sort();
  }, [timeZone, profile.profile?.timeZone]);

  // Dirty State Calculation
  const isDirty = useMemo(() => {
    if (name.trim() !== initialSnapshot.name.trim()) return true;
    if (phone.trim() !== initialSnapshot.phone.trim()) return true;
    if (organization.trim() !== initialSnapshot.organization.trim()) return true;
    if (department.trim() !== initialSnapshot.department.trim()) return true;
    if (jobTitle.trim() !== initialSnapshot.jobTitle.trim()) return true;
    if (graduationYear.trim() !== initialSnapshot.graduationYear.trim()) return true;
    if (githubUrl.trim() !== initialSnapshot.githubUrl.trim()) return true;
    if (linkedinUrl.trim() !== initialSnapshot.linkedinUrl.trim()) return true;
    if (bio.trim() !== initialSnapshot.bio.trim()) return true;
    if (timeZone !== initialSnapshot.timeZone) return true;

    // Skills array comparison
    if (skills.length !== initialSnapshot.skills.length) return true;
    for (let i = 0; i < skills.length; i++) {
      if (skills[i] !== initialSnapshot.skills[i]) return true;
    }

    // Notification prefs comparison
    const p1 = notificationPrefs;
    const p2 = initialSnapshot.notificationPrefs;
    if (
      p1.taskAssigned !== p2.taskAssigned ||
      p1.deadlineReminders !== p2.deadlineReminders ||
      p1.mentions !== p2.mentions ||
      p1.projectInvites !== p2.projectInvites ||
      p1.statusChanges !== p2.statusChanges
    ) {
      return true;
    }

    return false;
  }, [
    name,
    phone,
    organization,
    department,
    jobTitle,
    graduationYear,
    githubUrl,
    linkedinUrl,
    bio,
    timeZone,
    skills,
    notificationPrefs,
    initialSnapshot,
  ]);

  // Unsaved changes browser guard (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Client-side Validation Rules
  const clientValidationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    // Name
    if (!name.trim()) {
      errors.name = 'Full name is required.';
    }

    // Phone: E.164 (+ and 8-15 digits) or empty
    if (phone.trim()) {
      const e164Regex = /^\+[1-9]\d{7,14}$/;
      if (!e164Regex.test(phone.trim())) {
        errors.phone = 'Phone number must be in E.164 format (e.g. +14155552671).';
      }
    }

    // Organization, department, jobTitle <= 120
    if (organization.length > 120) {
      errors.organization = 'Organization must be 120 characters or fewer.';
    }
    if (department.length > 120) {
      errors.department = 'Department must be 120 characters or fewer.';
    }
    if (jobTitle.length > 120) {
      errors.jobTitle = 'Job title must be 120 characters or fewer.';
    }

    // Graduation Year: 1990-2100 or empty
    if (graduationYear.trim()) {
      const year = Number(graduationYear.trim());
      if (isNaN(year) || !Number.isInteger(year) || year < 1990 || year > 2100) {
        errors.graduationYear = 'Graduation year must be between 1990 and 2100.';
      }
    }

    // GitHub URL: HTTPS on github.com
    if (githubUrl.trim()) {
      const githubRegex = /^https:\/\/(www\.)?github\.com(\/.*)?$/;
      if (!githubRegex.test(githubUrl.trim())) {
        errors.githubUrl = 'GitHub URL must be an HTTPS URL on github.com.';
      }
    }

    // LinkedIn URL: HTTPS on linkedin.com
    if (linkedinUrl.trim()) {
      const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com(\/.*)?$/;
      if (!linkedinRegex.test(linkedinUrl.trim())) {
        errors.linkedinUrl = 'LinkedIn URL must be an HTTPS URL on linkedin.com.';
      }
    }

    // Bio <= 500
    if (bio.length > 500) {
      errors.bio = 'Bio must be 500 characters or fewer.';
    }

    // Skills
    if (skills.length > 20) {
      errors.skills = 'Maximum 20 skills allowed.';
    }

    return errors;
  }, [name, phone, organization, department, jobTitle, graduationYear, githubUrl, linkedinUrl, bio, skills]);

  // Combined field errors (client + server)
  const fieldErrors = useMemo(() => {
    return { ...clientValidationErrors, ...serverFieldErrors };
  }, [clientValidationErrors, serverFieldErrors]);

  const initials = getInitials(name || profile.name || '');
  const isVerified = Boolean(profile.verified);
  const memberSince = formatDate(profile.createdAt);
  const isPending =
    updateProfileMutation.isPending || updateProfileDetailsMutation.isPending;

  // Skills management
  const handleAddSkill = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e) e.preventDefault();

    const trimmed = skillInput.trim();
    if (!trimmed) return;

    if (skills.length >= 20) {
      setServerFieldErrors((prev) => ({
        ...prev,
        skills: 'Maximum 20 skills allowed.',
      }));
      return;
    }

    if (trimmed.length > 30) {
      setServerFieldErrors((prev) => ({
        ...prev,
        skills: 'Each skill must be 30 characters or fewer.',
      }));
      return;
    }

    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setServerFieldErrors((prev) => ({
        ...prev,
        skills: 'Skill already added.',
      }));
      return;
    }

    setSkills([...skills, trimmed]);
    setSkillInput('');
    setServerFieldErrors((prev) => {
      const next = { ...prev };
      delete next.skills;
      return next;
    });
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Avatar upload
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    // Check mime type (png, jpeg, webp)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const hasValidType =
      allowedTypes.includes(file.type.toLowerCase()) ||
      /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!hasValidType) {
      const msg = 'Avatar must be a PNG, JPEG, or WebP image.';
      setAvatarError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Check size <= 2MB
    if (file.size > 2 * 1024 * 1024) {
      const msg = 'Avatar file size must not exceed 2 MB.';
      setAvatarError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const res = await uploadAvatarMutation.mutateAsync(file);
      setAvatarUrl(res.avatarUrl);
      toast.success('Avatar updated successfully.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to upload avatar.';
      setAvatarError(msg);
      toast.error(msg);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Avatar delete
  const handleRemoveAvatar = async () => {
    setAvatarError('');
    try {
      await deleteAvatarMutation.mutateAsync();
      setAvatarUrl(null);
      toast.success('Avatar removed successfully.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to remove avatar.';
      setAvatarError(msg);
      toast.error(msg);
    }
  };

  // Single Save
  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setServerFieldErrors({});

    const isNameChanged = name.trim() !== (initialSnapshot.name || '').trim();
    const isProfileDetailsChanged =
      phone.trim() !== initialSnapshot.phone.trim() ||
      organization.trim() !== initialSnapshot.organization.trim() ||
      department.trim() !== initialSnapshot.department.trim() ||
      jobTitle.trim() !== initialSnapshot.jobTitle.trim() ||
      graduationYear.trim() !== initialSnapshot.graduationYear.trim() ||
      githubUrl.trim() !== initialSnapshot.githubUrl.trim() ||
      linkedinUrl.trim() !== initialSnapshot.linkedinUrl.trim() ||
      bio.trim() !== initialSnapshot.bio.trim() ||
      timeZone !== initialSnapshot.timeZone ||
      skills.length !== initialSnapshot.skills.length ||
      skills.some((s, i) => s !== initialSnapshot.skills[i]) ||
      notificationPrefs.taskAssigned !== initialSnapshot.notificationPrefs.taskAssigned ||
      notificationPrefs.deadlineReminders !== initialSnapshot.notificationPrefs.deadlineReminders ||
      notificationPrefs.mentions !== initialSnapshot.notificationPrefs.mentions ||
      notificationPrefs.projectInvites !== initialSnapshot.notificationPrefs.projectInvites ||
      notificationPrefs.statusChanges !== initialSnapshot.notificationPrefs.statusChanges;

    if (Object.keys(clientValidationErrors).length > 0) {
      setErrorMessage('Please fix the validation errors before saving.');
      return;
    }

    if (!isNameChanged && !isProfileDetailsChanged) {
      return;
    }

    try {
      let updatedUserObj = profileData || user;

      // 1. Update Name if changed
      if (isNameChanged) {
        const nameRes = await updateProfileMutation.mutateAsync({ name: name.trim() });
        updatedUserObj = nameRes;
      }

      // 2. Update Profile Details if changed
      if (isProfileDetailsChanged) {
        const profilePayload: UpdateProfileRequest = {
          phone: phone.trim() || null,
          organization: organization.trim() || null,
          department: department.trim() || null,
          jobTitle: jobTitle.trim() || null,
          graduationYear: graduationYear.trim() ? Number(graduationYear.trim()) : null,
          githubUrl: githubUrl.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          bio: bio.trim() || null,
          skills: skills,
          timeZone: timeZone || 'UTC',
          notificationPrefs: notificationPrefs,
        };

        const profileRes = await updateProfileDetailsMutation.mutateAsync(profilePayload);
        updatedUserObj = profileRes;
      }

      // 3. Update TimeZoneContext immediately
      if (timeZone) {
        setContextTimeZone(timeZone);
      }

      // 4. Update AuthContext
      if (updatedUserObj) {
        updateUser(updatedUserObj as any);
      }

      // 5. Update initial snapshot to mark clean
      setInitialSnapshot({
        name: name.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        graduationYear: graduationYear.trim(),
        githubUrl: githubUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        bio: bio.trim(),
        skills: [...skills],
        timeZone: timeZone,
        notificationPrefs: { ...notificationPrefs },
      });

      // 6. Success toast and banner
      setSuccessMessage('Profile updated successfully.');
      toast.success('Profile updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      if (err?.response?.data?.fieldErrors) {
        setServerFieldErrors(err.response.data.fieldErrors);
      }
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to update profile.';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  // Navigation guard helper for links on the page
  const handleGuardedNavigation = (path: string) => {
    if (isDirty) {
      setPendingLeavePath(path);
    } else {
      navigate(path);
    }
  };

  const userEmail = profileData?.email || user?.email || '';
  const configuredProviders = providersData?.providers || [];

  const getProviderIcon = (key: string) => {
    const k = key.toLowerCase();
    if (k === 'google') return <GoogleIcon className="w-4 h-4 shrink-0" />;
    if (k === 'github') return <Github className="w-4 h-4 shrink-0 text-slate-800" />;
    return <Shield className="w-4 h-4 shrink-0 text-slate-500" />;
  };

  const handleConnectProvider = async (providerKey: string) => {
    try {
      setConnectingProvider(providerKey);
      const res = await startOAuthLinkMutation.mutateAsync(providerKey);
      if (res?.url) {
        window.location.assign(res.url);
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to start connecting provider';
      toast.error(errorMsg);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!providerToDisconnect) return;
    const pKey = providerToDisconnect.key;
    const pLabel = providerToDisconnect.label;
    try {
      await disconnectProviderMutation.mutateAsync(pKey);
      toast.success(`Disconnected ${pLabel}`);
      setProviderToDisconnect(null);
      setLastLoginMethodError(null);
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    } catch (err: any) {
      const status = err?.response?.status;
      const errorCode = err?.response?.data?.code || err?.response?.data?.error;
      if (status === 409 || errorCode === 'LAST_LOGIN_METHOD') {
        const msg = 'Set a password first so you can still sign in';
        setLastLoginMethodError(msg);
        toast.error(msg);
        setProviderToDisconnect(null);
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
      } else {
        toast.error(err?.response?.data?.message || 'Failed to disconnect account');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col" data-testid="profile-page">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Account Profile
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your personal identity, credentials, professional info, and preferences.
            </p>
          </div>

          {/* Quick Dirty-State Status */}
          <div className="flex items-center gap-3">
            <span
              data-testid="dirty-indicator-header"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none border transition-colors ${
                isDirty
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span>{isDirty ? 'Unsaved changes' : 'Profile up to date'}</span>
            </span>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {successMessage && (
          <div
            data-testid="profile-success-msg"
            className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 animate-in fade-in duration-200 shadow-xs"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            data-testid="profile-error-msg"
            className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-2.5 animate-in fade-in duration-200 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !user ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
            <span className="text-sm font-medium text-slate-500">Loading your profile...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8">
            {/* 1. OVERVIEW CARD */}
            <div
              data-testid="profile-card"
              className="rounded-3xl bg-white border border-slate-200/80 shadow-xs overflow-hidden"
            >
              {/* Top Identity Banner */}
              <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5 min-w-0">
                  {/* Avatar with Initials / Image */}
                  <div className="relative group shrink-0">
                    <div
                      data-testid="profile-avatar"
                      className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-500 via-sky-400 to-indigo-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-sky-500/20 select-none overflow-hidden"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={name || 'Avatar'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                        {name || profile.name || 'Developer'}
                      </h2>
                      {/* Verified Badge */}
                      <span
                        data-testid="verified-badge"
                        className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold select-none ${
                          isVerified
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isVerified ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Unverified</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 font-medium truncate">
                      {profile.email || 'No email associated'}
                    </p>
                  </div>
                </div>

                {/* Member since timestamp */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-white/10 pt-4 sm:pt-0 text-xs text-slate-300 shrink-0">
                  <span className="text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                    Member Since
                  </span>
                  <span
                    data-testid="member-since"
                    className="font-semibold text-white mt-0.5 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>{memberSince}</span>
                  </span>
                </div>
              </div>

              {/* Overview Details Form */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Avatar Action Controls */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarFileSelect}
                    className="hidden"
                    data-testid="input-avatar-file"
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadAvatarMutation.isPending}
                      data-testid="btn-upload-avatar"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploadAvatarMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Upload Avatar</span>
                    </button>

                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={deleteAvatarMutation.isPending}
                        data-testid="btn-remove-avatar"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deleteAvatarMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Remove Avatar</span>
                      </button>
                    )}

                    <span className="text-xs text-slate-400">
                      PNG, JPEG or WebP up to 2 MB
                    </span>
                  </div>

                  {avatarError && (
                    <p data-testid="avatar-error" className="text-xs text-rose-500 mt-2 font-medium">
                      {avatarError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="block text-sm font-bold text-slate-800 mb-2"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="profile-name"
                        data-testid="input-profile-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (serverFieldErrors.name) {
                            setServerFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.name;
                              return copy;
                            });
                          }
                        }}
                        placeholder="Your name"
                        className={`w-full pl-10 pr-4 h-11 rounded-xl border text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
                          fieldErrors.name
                            ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-500'
                            : 'border-slate-200 bg-slate-50/50 focus:ring-sky-500/20 focus:border-sky-500'
                        }`}
                      />
                    </div>
                    {fieldErrors.name && (
                      <p data-testid="field-error-name" className="text-xs text-rose-500 mt-1.5 font-medium">
                        {fieldErrors.name}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                      Your display name visible across project boards, assignments, and @mentions.
                    </p>
                  </div>

                  {/* Email Address (Read-only) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="profile-email"
                        className="block text-sm font-bold text-slate-800"
                      >
                        Email Address
                      </label>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-medium select-none">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Read-only</span>
                      </span>
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="profile-email"
                        data-testid="input-profile-email"
                        type="email"
                        readOnly
                        disabled
                        value={profile.email || ''}
                        className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-100 text-sm font-medium text-slate-500 cursor-not-allowed select-none"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      Email address is tied to your primary workspace identity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. PROFESSIONAL CARD */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Professional Experience</h3>
                  <p className="text-xs text-slate-500">
                    Share your current workplace, department, and academic background.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Organization */}
                <div>
                  <label
                    htmlFor="profile-org"
                    className="block text-sm font-bold text-slate-800 mb-2"
                  >
                    Organization
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="profile-org"
                      data-testid="input-profile-org"
                      type="text"
                      maxLength={120}
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                    />
                  </div>
                  {fieldErrors.organization && (
                    <p
                      data-testid="field-error-organization"
                      className="text-xs text-rose-500 mt-1.5 font-medium"
                    >
                      {fieldErrors.organization}
                    </p>
                  )}
                </div>

                {/* Department */}
                <div>
                  <label
                    htmlFor="profile-dept"
                    className="block text-sm font-bold text-slate-800 mb-2"
                  >
                    Department
                  </label>
                  <input
                    id="profile-dept"
                    data-testid="input-profile-dept"
                    type="text"
                    maxLength={120}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Core Engineering"
                    className="w-full px-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                  />
                  {fieldErrors.department && (
                    <p
                      data-testid="field-error-department"
                      className="text-xs text-rose-500 mt-1.5 font-medium"
                    >
                      {fieldErrors.department}
                    </p>
                  )}
                </div>

                {/* Job Title */}
                <div>
                  <label
                    htmlFor="profile-job"
                    className="block text-sm font-bold text-slate-800 mb-2"
                  >
                    Job Title
                  </label>
                  <input
                    id="profile-job"
                    data-testid="input-profile-job"
                    type="text"
                    maxLength={120}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                  />
                  {fieldErrors.jobTitle && (
                    <p
                      data-testid="field-error-jobTitle"
                      className="text-xs text-rose-500 mt-1.5 font-medium"
                    >
                      {fieldErrors.jobTitle}
                    </p>
                  )}
                </div>

                {/* Graduation Year */}
                <div>
                  <label
                    htmlFor="profile-grad"
                    className="block text-sm font-bold text-slate-800 mb-2"
                  >
                    Graduation Year
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="profile-grad"
                      data-testid="input-profile-grad"
                      type="number"
                      min={1990}
                      max={2100}
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      placeholder="e.g. 2024 (1990 - 2100)"
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                    />
                  </div>
                  {fieldErrors.graduationYear && (
                    <p
                      data-testid="field-error-graduationYear"
                      className="text-xs text-rose-500 mt-1.5 font-medium"
                    >
                      {fieldErrors.graduationYear}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. LINKS CARD */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Links & Profiles</h3>
                  <p className="text-xs text-slate-500">
                    Connect your public developer and professional social profiles.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* GitHub */}
                <div>
                  <label
                    htmlFor="profile-github"
                    className="block text-sm font-bold text-slate-800 mb-2"
                  >
                    GitHub Profile
                  </label>
                  <div className="relative">
                    <Github className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="profile-github"
                      data-testid="input-profile-github"
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                      className={`w-full pl-10 pr-4 h-11 rounded-xl border text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
                        fieldErrors.githubUrl
                          ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 bg-slate-50/50 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.githubUrl && (
                    <p
                      data-testid="field-error-githubUrl"
                      className="text-xs text-rose-500 mt-1.5 font-medium"
                    >
                      {fieldErrors.githubUrl}
                    </p>
                  )}
                </div>

                {/* LinkedIn */}
                <div>
                  <label
                    htmlFor="profile-linkedin"
                    className="block text-sm font-bold text-slate-800 mb-2"
                  >
                    LinkedIn Profile
                  </label>
                  <div className="relative">
                    <Linkedin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="profile-linkedin"
                      data-testid="input-profile-linkedin"
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className={`w-full pl-10 pr-4 h-11 rounded-xl border text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
                        fieldErrors.linkedinUrl
                          ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 bg-slate-50/50 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.linkedinUrl && (
                    <p
                      data-testid="field-error-linkedinUrl"
                      className="text-xs text-rose-500 mt-1.5 font-medium"
                    >
                      {fieldErrors.linkedinUrl}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 4. ABOUT CARD (Bio & Skills) */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">About & Skills</h3>
                  <p className="text-xs text-slate-500">
                    Tell others about your background, expertise, and technical specialties.
                  </p>
                </div>
              </div>

              {/* Bio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="profile-bio"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Biography
                  </label>
                  <span
                    data-testid="bio-char-counter"
                    className={`text-xs font-semibold ${
                      bio.length > 500 ? 'text-rose-500' : 'text-slate-400'
                    }`}
                  >
                    {bio.length}/500
                  </span>
                </div>
                <textarea
                  id="profile-bio"
                  data-testid="textarea-profile-bio"
                  rows={4}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short summary of yourself, what you are building, or what technologies you enjoy working with..."
                  className={`w-full p-3.5 rounded-xl border text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors resize-none ${
                    fieldErrors.bio
                      ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 bg-slate-50/50 focus:ring-sky-500/20 focus:border-sky-500'
                  }`}
                />
                {fieldErrors.bio && (
                  <p data-testid="field-error-bio" className="text-xs text-rose-500 mt-1.5 font-medium">
                    {fieldErrors.bio}
                  </p>
                )}
              </div>

              {/* Skills Chip Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="profile-skills"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Technical Skills
                  </label>
                  <span data-testid="skills-count" className="text-xs font-semibold text-slate-400">
                    {skills.length}/20 skills
                  </span>
                </div>

                {/* Chips Display */}
                <div className="flex flex-wrap items-center gap-2 mb-3 min-h-[32px]">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      data-testid={`skill-chip-${skill}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        data-testid={`btn-remove-skill-${skill}`}
                        className="text-sky-400 hover:text-sky-700 p-0.5 rounded-md hover:bg-sky-100 transition-colors cursor-pointer"
                        title={`Remove ${skill}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No skills added yet.</span>
                  )}
                </div>

                {/* Input to add skill */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="profile-skills"
                      data-testid="input-profile-skills"
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={handleAddSkill}
                      disabled={skills.length >= 20}
                      placeholder={
                        skills.length >= 20
                          ? 'Maximum skills limit reached (20)'
                          : 'Type a skill (e.g. React, Spring Boot) and press Enter'
                      }
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    disabled={!skillInput.trim() || skills.length >= 20}
                    data-testid="btn-add-skill"
                    className="px-4 h-11 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    Add Skill
                  </button>
                </div>
                {fieldErrors.skills && (
                  <p data-testid="field-error-skills" className="text-xs text-rose-500 mt-1.5 font-medium">
                    {fieldErrors.skills}
                  </p>
                )}
              </div>
            </div>

            {/* 5. PREFERENCES CARD */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Preferences</h3>
                  <p className="text-xs text-slate-500">
                    Configure your display timezone and notifications preferences.
                  </p>
                </div>
              </div>

              {/* Timezone Select */}
              <div>
                <label
                  htmlFor="profile-timezone"
                  className="block text-sm font-bold text-slate-800 mb-2"
                >
                  Time Zone
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="profile-timezone"
                    data-testid="select-profile-timezone"
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors cursor-pointer"
                  >
                    {availableTimeZones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz} {tz === getBrowserTimeZone() ? '(Browser Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Dates and times throughout Taskoura will be formatted according to this time zone.
                </p>
              </div>

              {/* Notification Toggles */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-500" />
                  <span>Notification Preferences</span>
                </h4>
                <p className="text-xs text-slate-500 mb-1">
                  Select which workspace events trigger in-app and email notifications.
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  Account and security emails are always sent.
                </p>

                <div className="space-y-4">
                  {/* Task Assigned */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 block">
                        Task Assignments
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Notify me whenever a project task is assigned to me.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-pref-taskAssigned"
                      checked={Boolean(notificationPrefs.taskAssigned)}
                      onChange={(e) =>
                        setNotificationPrefs({
                          ...notificationPrefs,
                          taskAssigned: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded-md text-sky-600 focus:ring-sky-500 border-slate-300 transition cursor-pointer"
                    />
                  </label>

                  {/* Deadline Reminders */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 block">
                        Deadline Reminders
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Notify me 24 hours before upcoming deadlines for assigned tasks.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-pref-deadlineReminders"
                      checked={Boolean(notificationPrefs.deadlineReminders)}
                      onChange={(e) =>
                        setNotificationPrefs({
                          ...notificationPrefs,
                          deadlineReminders: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded-md text-sky-600 focus:ring-sky-500 border-slate-300 transition cursor-pointer"
                    />
                  </label>

                  {/* Mentions */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 block">
                        Mentions
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Notify me when someone mentions me (@name) in a task discussion.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-pref-mentions"
                      checked={Boolean(notificationPrefs.mentions)}
                      onChange={(e) =>
                        setNotificationPrefs({
                          ...notificationPrefs,
                          mentions: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded-md text-sky-600 focus:ring-sky-500 border-slate-300 transition cursor-pointer"
                    />
                  </label>

                  {/* Project Invites */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 block">
                        Project Invites
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Notify me when a project owner adds me to a new workspace.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-pref-projectInvites"
                      checked={Boolean(notificationPrefs.projectInvites)}
                      onChange={(e) =>
                        setNotificationPrefs({
                          ...notificationPrefs,
                          projectInvites: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded-md text-sky-600 focus:ring-sky-500 border-slate-300 transition cursor-pointer"
                    />
                  </label>

                  {/* Status Changes */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 block">
                        Task Status Changes
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Notify me whenever the status of a task changes on active boards.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-pref-statusChanges"
                      checked={Boolean(notificationPrefs.statusChanges)}
                      onChange={(e) =>
                        setNotificationPrefs({
                          ...notificationPrefs,
                          statusChanges: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded-md text-sky-600 focus:ring-sky-500 border-slate-300 transition cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 6. CONTACT CARD */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Contact Information</h3>
                  <p className="text-xs text-slate-500">
                    Optional phone number for workspace contact.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="profile-phone"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Phone Number
                  </label>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Optional, not verified
                  </span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="profile-phone"
                    data-testid="input-profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+14155552671"
                    className={`w-full pl-10 pr-4 h-11 rounded-xl border text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
                      fieldErrors.phone
                        ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-500'
                        : 'border-slate-200 bg-slate-50/50 focus:ring-sky-500/20 focus:border-sky-500'
                    }`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p data-testid="field-error-phone" className="text-xs text-rose-500 mt-1.5 font-medium">
                    {fieldErrors.phone}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">
                  Format: E.164 (+ followed by 8 to 15 digits, e.g. +14155552671). Phone number is never verified.
                </p>
              </div>
            </div>

            {/* 7. SECURITY CARD */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Security & Access</h3>
                  <p className="text-xs text-slate-500">
                    Manage connected sign-in accounts and your workspace password.
                  </p>
                </div>
              </div>

              {/* Connected Accounts */}
              <div
                data-testid="connected-accounts"
                className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4 space-y-3"
              >
                <div>
                  <span className="font-semibold block text-slate-800 text-sm">Connected accounts</span>
                  <span className="text-xs text-slate-500">
                    Sign in directly with your external provider accounts.
                  </span>
                </div>

                {linkErrorBanner && (
                  <div
                    data-testid="link-error-alert"
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{linkErrorBanner}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinkErrorBanner(null)}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                      aria-label="Dismiss error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {lastLoginMethodError && (
                  <div
                    data-testid="last-login-method-alert"
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>{lastLoginMethodError}</span>
                    </div>
                    <Link
                      to={`/forgot-password?email=${encodeURIComponent(userEmail)}`}
                      onClick={(e) => {
                        if (isDirty) {
                          e.preventDefault();
                          handleGuardedNavigation(`/forgot-password?email=${encodeURIComponent(userEmail)}`);
                        }
                      }}
                      className="font-bold underline text-amber-900 hover:text-amber-700 shrink-0"
                    >
                      Set password
                    </Link>
                  </div>
                )}

                {profileData?.passwordLoginEnabled === false && (
                  <div
                    data-testid="no-password-login-note"
                    className="p-3 rounded-xl bg-sky-50 border border-sky-100 text-sky-800 text-xs flex items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>
                        You sign in with Google or GitHub. You can add a password with{' '}
                        <Link
                          to={`/forgot-password?email=${encodeURIComponent(userEmail)}`}
                          onClick={(e) => {
                            if (isDirty) {
                              e.preventDefault();
                              handleGuardedNavigation(`/forgot-password?email=${encodeURIComponent(userEmail)}`);
                            }
                          }}
                          className="font-bold underline text-sky-900 hover:text-sky-700"
                        >
                          Forgot password
                        </Link>
                        .
                      </span>
                    </div>
                  </div>
                )}

                {/* Provider Rows */}
                <div className="divide-y divide-slate-200/60 pt-1">
                  {providersLoading ? (
                    <div className="py-4 flex items-center justify-center text-xs text-slate-400 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading authentication providers...</span>
                    </div>
                  ) : configuredProviders.length === 0 ? (
                    <div className="py-3 text-xs text-slate-500 text-center">
                      No connected accounts yet
                    </div>
                  ) : (
                    configuredProviders.map((provider) => {
                      const pKey = provider.key.toLowerCase();
                      const connectedEntry = (profileData?.providers || []).find((p: any) => {
                        const k = typeof p === 'string' ? p : p?.provider;
                        return k?.toLowerCase() === pKey;
                      });
                      const isConnected = !!connectedEntry;
                      const connectedEmail =
                        typeof connectedEntry === 'object' && connectedEntry?.email
                          ? connectedEntry.email
                          : userEmail;
                      const linkedAtDate =
                        typeof connectedEntry === 'object' && connectedEntry?.linkedAt
                          ? formatDate(connectedEntry.linkedAt)
                          : formatDate(profileData?.createdAt || null);

                      return (
                        <div
                          key={provider.key}
                          data-testid={`provider-row-${pKey}`}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                              {getProviderIcon(pKey)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-slate-900 block truncate">
                                {provider.label}
                              </span>
                              {isConnected ? (
                                <div className="text-xs text-slate-500 truncate space-x-1">
                                  <span className="font-medium text-slate-600">{connectedEmail}</span>
                                  <span>•</span>
                                  <span>Connected on {linkedAtDate}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 block">Not connected</span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isConnected ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setLastLoginMethodError(null);
                                  setProviderToDisconnect(provider);
                                }}
                                data-testid={`disconnect-provider-${pKey}`}
                                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConnectProvider(provider.key)}
                                disabled={connectingProvider === provider.key}
                                data-testid={`connect-provider-${pKey}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {connectingProvider === provider.key && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                )}
                                <span>Connect</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Change Password Link */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    Account Password
                  </span>
                  <span className="text-xs text-slate-500 block">
                    Update your password by requesting a secure verification code.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleGuardedNavigation('/forgot-password')}
                  data-testid="link-change-password"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors p-2 hover:bg-sky-50 rounded-xl"
                >
                  <span>Change password</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SINGLE SAVE & ACTION FOOTER */}
            <div className="sticky bottom-4 z-20 p-4 sm:p-5 rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  data-testid="dirty-indicator"
                  className={`text-xs font-semibold ${
                    isDirty ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {isDirty ? 'Unsaved changes' : 'Profile up to date'}
                </span>
              </div>

              <button
                type="submit"
                data-testid="btn-save-profile"
                onClick={handleSave}
                disabled={isPending || Object.keys(clientValidationErrors).length > 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Unsaved Changes Confirmation Modal */}
      {pendingLeavePath && (
        <div
          data-testid="unsaved-changes-dialog"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Unsaved Changes</h3>
            </div>
            <p className="text-sm text-slate-600">
              You have unsaved changes on your profile. Are you sure you want to leave this page?
              Any unsaved edits will be lost.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="btn-cancel-leave"
                onClick={() => setPendingLeavePath(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Stay Here
              </button>
              <button
                type="button"
                data-testid="btn-confirm-leave"
                onClick={() => {
                  const target = pendingLeavePath;
                  setPendingLeavePath(null);
                  navigate(target);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Provider Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!providerToDisconnect}
        title={`Disconnect ${providerToDisconnect?.label || 'account'}`}
        message={`Are you sure you want to disconnect your ${providerToDisconnect?.label || ''} account? You will no longer be able to use it to sign in to Taskoura.`}
        confirmText="Disconnect"
        cancelText="Cancel"
        isPending={disconnectProviderMutation.isPending}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => {
          if (!disconnectProviderMutation.isPending) {
            setProviderToDisconnect(null);
          }
        }}
      />
    </div>
  );
};

export default ProfilePage;
