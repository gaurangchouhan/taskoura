import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export const ProfilePage: React.FC = () => {
  const { user, login, token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/me');
        if (res.data) {
          setName(res.data.name || '');
          setEmail(res.data.email || '');
        }
      } catch {
        setName(user?.fullName || user?.name || '');
        setEmail(user?.email || '');
      }
    };
    fetchProfile();
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.put('/users/me', { name });
      if (token) {
        login(token, {
          email,
          fullName: res.data?.name || name,
          name: res.data?.name || name,
        });
      }
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Failed to update profile: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Student Profile & Account Settings">
      <div className="p-6 lg:p-10 w-full max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="font-heading font-extrabold text-2xl lg:text-3xl text-[#1E2761]">Profile Settings</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your student engineer credentials, university email, and security configurations.
          </p>
        </div>

        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 lg:p-10 border border-slate-200 shadow-card">
          <div className="flex items-center gap-6 pb-8 border-b border-slate-100 mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#1E2761] to-[#00A896] text-white flex items-center justify-center font-heading font-bold text-3xl shadow-md">
              {name.charAt(0) || email.charAt(0) || 'U'}
            </div>
            <div>
              <h3 className="font-heading font-bold text-2xl text-[#1E2761]">{name || 'Student Engineer'}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{email}</p>
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-[#F0FDFA] text-[#00A896] border border-[#76F4E0]/40">
                Verified Account
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-[#1E2761] focus:outline-none focus:border-[#00A896] focus:ring-2 focus:ring-[#00A896]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Registered Email (Read Only)</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                University email addresses are tied to your cryptographic JWT and biometric lab link.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
};
