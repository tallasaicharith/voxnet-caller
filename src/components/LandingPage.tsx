import React, { useState } from 'react';
import { Video, PlusCircle, ArrowRight, ShieldCheck, Zap, Globe, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onCreateRoom: (title: string, name: string) => void;
  onJoinRoom: (roomId: string, name: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [userName, setUserName] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setIsCreating(true);
    await onCreateRoom(meetingTitle.trim() || 'VoxNet Meeting', userName.trim());
    setIsCreating(false);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !joinRoomId.trim()) return;
    onJoinRoom(joinRoomId.trim(), userName.trim());
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#08090C] text-slate-100">
      {/* Background Ambient Orbs */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
            <Video className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Vox<span className="text-blue-500">Net</span>
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
            Enterprise WebRTC
          </span>
        </div>

        <div className="flex items-center space-x-6 text-sm text-slate-400 font-medium">
          <span className="flex items-center space-x-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Network Operational</span>
          </span>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 max-w-6xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto">
        {/* Left Column: Vision & Statement */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Ultra-low latency video communication platform</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-white">
            Meet without <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              the friction.
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl font-normal leading-relaxed">
            Crystal-clear HD voice & video calling powered by native WebRTC. Secure room allocation, active speaker detection, screen sharing, canvas meeting recording, and instant real-time messaging.
          </p>

          {/* Badges */}
          <div className="pt-4 grid grid-cols-3 gap-4 max-w-lg">
            <div className="flex items-center space-x-2.5 text-sm text-slate-300">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Encrypted P2P</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-slate-300">
              <Zap className="w-4 h-4 text-blue-400" />
              <span>Sub-100ms Latency</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-slate-300">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>No Downloads</span>
            </div>
          </div>
        </div>

        {/* Right Column: Action Card */}
        <div className="lg:col-span-5">
          <div className="glass-panel p-8 rounded-2xl shadow-2xl border border-white/10 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Start or Join Call</h2>
              <p className="text-xs text-slate-400">Enter your display name to begin your session</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Mercer"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm focus:outline-none placeholder-slate-500"
                  required
                />
              </div>

              {/* Create Room Form */}
              <form onSubmit={handleCreate} className="space-y-3 pt-2">
                <input
                  type="text"
                  placeholder="Meeting Title (Optional)"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-xs focus:outline-none placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={!userName.trim() || isCreating}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm text-white transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isCreating ? 'Creating Room...' : 'Create New Meeting'}</span>
                </button>
              </form>

              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <span className="relative px-3 bg-[#12151C] text-[10px] uppercase font-semibold tracking-wider text-slate-500">OR JOIN WITH CODE</span>
              </div>

              {/* Join Room Form */}
              <form onSubmit={handleJoin} className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. vox-k7x-92p"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl glass-input text-white text-sm focus:outline-none placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!userName.trim() || !joinRoomId.trim()}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm text-white transition-all flex items-center space-x-1.5 border border-white/10"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
        <div>VoxNet Video Calling Platform &copy; 2026. Built with React & WebRTC.</div>
        <div className="flex space-x-4">
          <span className="hover:text-slate-400 cursor-pointer">Security</span>
          <span className="hover:text-slate-400 cursor-pointer">Architecture</span>
          <span className="hover:text-slate-400 cursor-pointer">Diagnostics</span>
        </div>
      </footer>
    </div>
  );
};
