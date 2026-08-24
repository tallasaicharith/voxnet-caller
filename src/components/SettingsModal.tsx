import React, { useState } from 'react';
import { X, Mic, Video, Activity, Info } from 'lucide-react';
import { QualityReport } from '../rtc/ConnectionQualityManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  qualityReports: Map<string, QualityReport>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  qualityReports,
}) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'video' | 'diagnostics'>('diagnostics');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-xl glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#0B0D12]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Settings & Diagnostics</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-3 border-b-2 flex items-center justify-center space-x-2 transition-colors ${
              activeTab === 'audio' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-3 border-b-2 flex items-center justify-center space-x-2 transition-colors ${
              activeTab === 'video' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex-1 py-3 border-b-2 flex items-center justify-center space-x-2 transition-colors ${
              activeTab === 'diagnostics' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'audio' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                <span className="font-semibold text-slate-200">Audio Processing Constraints</span>
                <p className="text-slate-400">Echo Cancellation, Background Noise Suppression, and Automatic Gain Control are active on all microphone tracks.</p>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                <span className="font-semibold text-slate-200">Video Resolution</span>
                <p className="text-slate-400">Targeting 720p HD at 30 FPS with dynamic bandwidth scaling.</p>
              </div>
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-blue-400">
                <Info className="w-4 h-4" />
                <span className="font-medium">Real-Time WebRTC Connection Telemetry</span>
              </div>

              {qualityReports.size === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900 text-slate-500 text-center">
                  No active remote peer statistics available yet.
                </div>
              ) : (
                Array.from(qualityReports.entries()).map(([socketId, report]) => (
                  <div key={socketId} className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-slate-200 font-medium">
                      <span>Peer Socket: {socketId.substring(0, 8)}...</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                        {report.rating}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400">
                      <div>RTT: <span className="text-white font-mono">{report.rttMs} ms</span></div>
                      <div>Bitrate: <span className="text-white font-mono">{report.bitrateKbps} kbps</span></div>
                      <div>Packet Loss: <span className="text-white font-mono">{report.packetLossPercent}%</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
