import React, { useEffect, useRef } from 'react';
import { MicOff, Pin, User, Wifi, Sparkles } from 'lucide-react';
import { ParticipantState } from '../types/signaling';

interface VideoTileProps {
  participant: ParticipantState;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  onTogglePin?: (socketId: string) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal = false,
  isActiveSpeaker = false,
  isPinned = false,
  onTogglePin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'Excellent': return 'text-emerald-400';
      case 'Good': return 'text-blue-400';
      case 'Fair': return 'text-yellow-400';
      case 'Poor': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden glass-panel border border-white/10 group transition-all duration-300 ${
        isActiveSpeaker ? 'speaking-glow border-emerald-500/50' : ''
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal}
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          participant.isCameraOff ? 'opacity-0' : 'opacity-100'
        } ${isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''}`}
      />

      {/* Avatar Fallback */}
      {participant.isCameraOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 text-xl font-semibold">
            {participant.name ? participant.name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
          </div>
          <span className="mt-2 text-xs text-slate-400 font-medium">{participant.name}</span>
        </div>
      )}

      {/* Top Left Badges */}
      <div className="absolute top-3 left-3 flex items-center space-x-2 pointer-events-none">
        {participant.role === 'HOST' && (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-semibold tracking-wider uppercase">
            Host
          </span>
        )}
        {participant.isScreenSharing && (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-semibold flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>Sharing</span>
          </span>
        )}
      </div>

      {/* Top Right Pin & Quality Badge */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onTogglePin && (
          <button
            type="button"
            onClick={() => onTogglePin(participant.socketId)}
            className={`p-1.5 rounded-lg glass-pill transition-colors ${
              isPinned ? 'text-blue-400 bg-blue-500/20' : 'text-slate-400 hover:text-white'
            }`}
            title={isPinned ? 'Unpin' : 'Pin participant'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom Name Overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl glass-pill bg-black/50 text-xs font-medium text-slate-200">
          <span>{participant.name} {isLocal ? '(You)' : ''}</span>
          {participant.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
        </div>

        <div className="flex items-center space-x-1 px-2 py-1 rounded-lg glass-pill bg-black/40 text-[11px]">
          <Wifi className={`w-3 h-3 ${getQualityColor(participant.connectionQuality)}`} />
        </div>
      </div>
    </div>
  );
};
