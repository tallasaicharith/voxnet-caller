import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Shield, UserX, VolumeX } from 'lucide-react';
import { ParticipantState } from '../types/signaling';

interface ParticipantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantState[];
  currentUserId: string;
  isHost: boolean;
  onRequestRemoteMute: (targetParticipantId: string) => void;
  onRemoveParticipant: (targetParticipantId: string) => void;
}

export const ParticipantDrawer: React.FC<ParticipantDrawerProps> = ({
  isOpen,
  onClose,
  participants,
  currentUserId,
  isHost,
  onRequestRemoteMute,
  onRemoveParticipant,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-80 glass-panel border-l border-white/10 z-40 flex flex-col shadow-2xl bg-[#0B0D12]/95 backdrop-blur-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold text-white">Participants</h3>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">
            {participants.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {participants.map((p) => {
          const isMe = p.userId === currentUserId;
          return (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-semibold text-slate-300">
                  {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-slate-200 truncate">{p.name} {isMe ? '(You)' : ''}</span>
                    {p.role === 'HOST' && <Shield className="w-3 h-3 text-blue-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-500">{p.connectionQuality} Connection</span>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center space-x-2">
                {p.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                )}

                {p.isCameraOff ? (
                  <VideoOff className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <Video className="w-3.5 h-3.5 text-blue-400" />
                )}

                {/* Host Control Actions */}
                {isHost && !isMe && (
                  <div className="flex items-center space-x-1 pl-2 border-l border-white/10">
                    <button
                      type="button"
                      onClick={() => onRequestRemoteMute(p.id)}
                      className="p-1 rounded text-slate-400 hover:text-yellow-400"
                      title="Request Mute"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveParticipant(p.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-400"
                      title="Remove from call"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
