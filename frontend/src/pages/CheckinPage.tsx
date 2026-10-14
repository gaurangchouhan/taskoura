import React, { useState } from 'react';
import { Fingerprint, CheckCircle2, AlertCircle, Clock, ShieldCheck, Download, Cpu } from 'lucide-react';
import { AppShell } from '../components/AppShell';

export const CheckinPage: React.FC = () => {
  const [slotNumber, setSlotNumber] = useState('1');
  const [selectedMember, setSelectedMember] = useState('Alex Rivera (You)');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<string | null>(null);

  const handleEnroll = () => {
    setIsEnrolling(true);
    setEnrollStatus('Waiting for optical sensor touch at Station LAB-BENCH-04...');
    setTimeout(() => {
      setIsEnrolling(false);
      setEnrollStatus(`Slot #${slotNumber} successfully enrolled and verified with biometric hash.`);
    }, 2500);
  };

  const logs = [
    { time: '10:24 AM', user: 'Alex Rivera', slot: '#01', status: 'Biometric Verified', station: 'LAB-BENCH-04' },
    { time: '09:45 AM', user: 'Priya Sharma', slot: '#02', status: 'Biometric Verified', station: 'LAB-BENCH-04' },
    { time: 'Yesterday 06:15 PM', user: 'Rahul Verma', slot: '#05', status: 'Session Complete (4h 20m)', station: 'LAB-BENCH-02' },
  ];

  return (
    <AppShell title="Hardware Biometric Check-in">
      <div className="p-6 lg:p-10 w-full max-w-[1680px] mx-auto space-y-8">
        {/* Top Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 lg:p-7 rounded-2xl border border-slate-200 shadow-card flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] border border-[#76F4E0] flex items-center justify-center text-[#00A896] shrink-0">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hardware Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-heading font-bold text-base text-[#1E2761]">ESP32 + R307 Online</span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1">Station: LAB-BENCH-04</p>
            </div>
          </div>

          <div className="bg-white p-6 lg:p-7 rounded-2xl border border-slate-200 shadow-card flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shrink-0">
              <Fingerprint className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Lab Presence</p>
              <p className="font-heading font-extrabold text-2xl text-[#1E2761] mt-1">3 of 4 Present</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">75% attendance quorum</p>
            </div>
          </div>

          <div className="bg-white p-6 lg:p-7 rounded-2xl border border-slate-200 shadow-card flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#F1F5FD] border border-[#CADCFC] flex items-center justify-center text-[#1E2761] shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Lab Hours</p>
              <p className="font-heading font-extrabold text-2xl text-[#1E2761] mt-1">46.5 hrs</p>
              <p className="text-xs text-slate-500 mt-1">Aggregated team attendance</p>
            </div>
          </div>
        </div>

        {/* Split Section: Slot Pairing & Live Activity */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Slot Registration Card */}
          <div className="bg-white rounded-2xl p-7 lg:p-8 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
              <div>
                <h3 className="font-heading font-bold text-xl text-[#1E2761]">Link Fingerprint Slot</h3>
                <p className="text-sm text-slate-500 mt-1">Map physical hardware slot (1-127) to an authenticated member</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0FDFA] text-[#00A896] border border-[#76F4E0]/40">
                R307 Optical
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Team Member</label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-[#1E2761] focus:outline-none focus:border-[#00A896] focus:ring-2 focus:ring-[#00A896]/20"
                >
                  <option value="Alex Rivera (You)">Alex Rivera (Owner)</option>
                  <option value="Priya Sharma">Priya Sharma (Backend Dev)</option>
                  <option value="Rahul Verma">Rahul Verma (Frontend Dev)</option>
                  <option value="Neha Patel">Neha Patel (QA / Tester)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Hardware Slot ID (1-127)</label>
                <input
                  type="number"
                  min="1"
                  max="127"
                  value={slotNumber}
                  onChange={(e) => setSlotNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-[#1E2761] focus:outline-none focus:border-[#00A896] focus:ring-2 focus:ring-[#00A896]/20"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Supported by onboard flash storage on R307 sensor.
                </p>
              </div>

              {enrollStatus && (
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#00A896] shrink-0" />
                  <span>{enrollStatus}</span>
                </div>
              )}

              <button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="w-full py-3.5 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Fingerprint className={`w-5 h-5 ${isEnrolling ? 'animate-bounce' : ''}`} />
                {isEnrolling ? 'Communicating with Sensor...' : 'Initiate Sensor Enrollment'}
              </button>
            </div>
          </div>

          {/* Right: Live Session Log Timeline */}
          <div className="bg-white rounded-2xl p-7 lg:p-8 border border-slate-200 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="font-heading font-bold text-xl text-[#1E2761]">Live Lab Session Log</h3>
                  <p className="text-sm text-slate-500 mt-1">Real-time biometric attendance audit timeline</p>
                </div>

                <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {logs.map((log, i) => (
                  <div key={i} className="relative flex items-start gap-4 pl-8">
                    <span className="absolute left-2.5 top-2 w-2.5 h-2.5 rounded-full bg-[#00A896] ring-4 ring-white"></span>
                    <div className="bg-[#F7F9FC] p-4 rounded-xl border border-slate-100 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-heading font-bold text-sm text-[#1E2761]">{log.user}</span>
                        <span className="text-xs font-mono text-slate-400">{log.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-mono font-medium text-slate-500">Slot {log.slot}</span>
                        <span>•</span>
                        <span className="font-semibold text-emerald-600">{log.status}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 font-mono">{log.station}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Auto-refresh enabled (WebSocket)</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
