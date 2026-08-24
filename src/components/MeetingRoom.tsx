import React, { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, Users, Settings,
  PhoneOff, Copy, Check, Disc, Subtitles, ShieldAlert
} from 'lucide-react';
import { RTCClient } from '../rtc/RTCClient';
import { RoomState, ParticipantState, ChatMessagePayload, FileAssetPayload } from '../types/signaling';
import { QualityReport } from '../rtc/ConnectionQualityManager';
import { VideoTile } from './VideoTile';
import { ChatDrawer } from './ChatDrawer';
import { ParticipantDrawer } from './ParticipantDrawer';
import { SettingsModal } from './SettingsModal';

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  userId?: string;
  initialMuted?: boolean;
  initialCameraOff?: boolean;
  onLeaveMeeting: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  roomId,
  userName,
  userId,
  initialMuted = false,
  initialCameraOff = false,
  onLeaveMeeting,
}) => {
  const [roomState, setRoomState] = useState<RoomState>(() => ({
    id: roomId,
    title: 'VoxNet Call',
    hostId: userId || 'p-local',
    isLocked: false,
    createdAt: new Date().toISOString(),
    participants: [{
      id: userId || 'p-local',
      socketId: 'local',
      name: userName || 'You',
      role: 'HOST',
      isMuted: initialMuted,
      isCameraOff: initialCameraOff,
      isScreenSharing: false,
      connectionQuality: 'Excellent',
      joinedAt: new Date().toISOString(),
    }]
  }));
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [activeSpeakerSocketId, setActiveSpeakerSocketId] = useState<string | null>(null);
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);

  // Media & Controls State
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isCameraOff, setIsCameraOff] = useState(initialCameraOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCaptionsActive, setIsCaptionsActive] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);

  // Drawers & Modals
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [muteToast, setMuteToast] = useState<string | null>(null);

  // Messages & Files & Telemetry
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [files, setFiles] = useState<FileAssetPayload[]>([]);
  const [qualityReports, setQualityReports] = useState<Map<string, QualityReport>>(new Map());

  // Meeting Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const rtcClientRef = useRef<RTCClient | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Timer
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    // Initialize RTC Client
    const client = new RTCClient({
      onRoomStateChange: (state) => setRoomState({ ...state }),
      onParticipantJoined: (p) => {
        console.log('Participant joined UI:', p.name);
      },
      onParticipantLeft: (pId) => {
        console.log('Participant left UI:', pId);
      },
      onRemoteStream: (socketId, stream) => {
        setRemoteStreams((prev) => {
          const updated = new Map(prev);
          updated.set(socketId, stream);
          return updated;
        });
      },
      onActiveSpeakerChange: (socketId) => setActiveSpeakerSocketId(socketId),
      onChatMessage: (msg) => setMessages((prev) => [...prev, msg]),
      onFileShare: (file) => setFiles((prev) => [...prev, file]),
      onHostMuteRequest: (requestedBy) => {
        setMuteToast(`Host (${requestedBy}) requested that you mute your microphone.`);
      },
      onQualityReport: (socketId, report) => {
        setQualityReports((prev) => {
          const updated = new Map(prev);
          updated.set(socketId, report);
          return updated;
        });
      },
      onError: (err) => console.error('RTC Error:', err),
    });

    rtcClientRef.current = client;

    client.initializeAndJoin(roomId, userName, userId).then(() => {
      if (initialMuted) client.toggleMicrophone();
      if (initialCameraOff) client.toggleCamera();
      const st = client.media.getStream();
      if (st) setLocalStream(st);
    });

    // Register join with API
    fetch(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId || 'local', userName }),
    }).catch(e => console.warn('Could not register join with backend:', e));

    // Message and Participant Polling for Vercel Serverless
    const pollInterval = setInterval(() => {
      fetch(`/api/rooms/${roomId}/messages`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch(() => {});

      fetch(`/api/rooms/${roomId}/participants`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.participants) && data.participants.length > 0) {
            setRoomState(prev => {
              if (!prev) return prev;
              const existingKeys = new Set(prev.participants.flatMap(p => [p.id, p.socketId, p.name]));
              const newParts = data.participants.filter((p: any) => !existingKeys.has(p.id) && !existingKeys.has(p.name));
              if (newParts.length === 0) return prev;
              const mapped = newParts.map((p: any) => ({
                id: p.id,
                socketId: p.socketId || p.id,
                name: p.name,
                role: p.role || 'PARTICIPANT',
                isMuted: false,
                isCameraOff: false,
                isScreenSharing: false,
                connectionQuality: 'Excellent' as const,
                joinedAt: p.joinedAt || new Date().toISOString(),
              }));
              return {
                ...prev,
                participants: [...prev.participants, ...mapped]
              };
            });
          }
        })
        .catch(() => {});
    }, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
      client.leaveRoom();
    };
  }, [roomId, userName, userId]);

  const toggleMic = () => {
    if (rtcClientRef.current) {
      const muted = rtcClientRef.current.toggleMicrophone();
      setIsMuted(muted);
    }
  };

  const toggleCam = () => {
    if (rtcClientRef.current) {
      const cameraOff = rtcClientRef.current.toggleCamera();
      setIsCameraOff(cameraOff);
    }
  };

  const toggleScreenShare = async () => {
    if (rtcClientRef.current) {
      const sharing = await rtcClientRef.current.toggleScreenShare();
      setIsScreenSharing(sharing);
    }
  };

  const toggleRecording = async () => {
    if (!rtcClientRef.current) return;
    if (isRecording) {
      rtcClientRef.current.recorder.stopRecording();
      setIsRecording(false);
    } else {
      // Map video elements
      const videoMap = new Map<string, HTMLVideoElement>();
      document.querySelectorAll('video').forEach((v, index) => {
        videoMap.set(`v-${index}`, v as HTMLVideoElement);
      });

      const audioStreams = new Map<string, MediaStream>();
      if (rtcClientRef.current.media.getStream()) {
        audioStreams.set('local', rtcClientRef.current.media.getStream()!);
      }
      remoteStreams.forEach((st, sId) => audioStreams.set(sId, st));

      rtcClientRef.current.recorder.onStateChange = (st) => {
        setIsRecording(st.isRecording);
        setRecordingDuration(st.durationSeconds);
      };

      await rtcClientRef.current.recorder.startRecording(videoMap, audioStreams);
    }
  };

  const toggleCaptions = () => {
    if (!rtcClientRef.current) return;
    if (isCaptionsActive) {
      rtcClientRef.current.captions.stopCaptions();
      setIsCaptionsActive(false);
      setCurrentCaption(null);
    } else {
      rtcClientRef.current.captions.onCaption = (entry) => {
        setCurrentCaption(`${entry.senderName}: ${entry.text}`);
      };
      const started = rtcClientRef.current.captions.startCaptions();
      setIsCaptionsActive(started);
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendMessage = (content: string) => {
    if (!content || !content.trim()) return;

    const newMsg: ChatMessagePayload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      meetingId: roomId,
      senderId: userId || 'local',
      senderName: userName || 'You',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMsg]);

    fetch(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg),
    }).catch(e => console.warn('Could not post chat message:', e));

    if (rtcClientRef.current) {
      rtcClientRef.current.signaling.sendChatMessage(roomId, userId || 'local', userName, content);
    }
  };

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', userName);

    try {
      const res = await fetch(`/api/rooms/${roomId}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.file) {
        setFiles(prev => [...prev, data.file]);
      }
    } catch (e) {
      console.error('File upload error:', e);
    }
  };

  const localSocketId = rtcClientRef.current?.signaling.getSocketId();
  const localParticipant = roomState?.participants.find(p => p.socketId === localSocketId || p.socketId === 'local' || p.id === userId);
  const isHost = localParticipant?.role === 'HOST';

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const rawParticipants = roomState ? roomState.participants : [];
  const participantsList = Array.from(
    new Map(rawParticipants.map(p => [p.socketId || p.id || p.name, p])).values()
  );

  return (
    <div className="relative h-screen w-screen bg-[#08090C] text-slate-100 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 glass-panel border-b border-white/10 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-base">{roomState?.title || 'VoxNet Call'}</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300 border border-white/10">
              {roomId}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg glass-pill text-xs font-medium text-slate-300 hover:text-white transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Link' : 'Share Link'}</span>
          </button>
        </div>

        {/* Status Indicators & Duration */}
        <div className="flex items-center space-x-4 text-xs font-medium">
          {isRecording && (
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              <Disc className="w-3.5 h-3.5" />
              <span>REC {formatTimer(recordingDuration)}</span>
            </div>
          )}

          <div className="px-3 py-1 rounded-full glass-pill text-slate-300 font-mono">
            {formatTimer(elapsedSeconds)}
          </div>
        </div>
      </header>

      {/* Main Video Area */}
      <main className="flex-1 relative p-4 overflow-hidden flex items-center justify-center">
        {participantsList.length === 0 ? (
          <div className="text-center text-slate-500 text-sm">Connecting securely to meeting...</div>
        ) : (
          <div className={`w-full h-full grid gap-4 ${
            participantsList.length === 1 ? 'grid-cols-1' :
            participantsList.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            participantsList.length <= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3'
          }`}>
            {participantsList.map((p) => {
              const currentSocketId = rtcClientRef.current?.signaling.getSocketId();
              const isMe = p.socketId === 'local' || p.socketId === currentSocketId || p.id === userId || p.id === 'p-local' || p.name === userName;
              const stream = isMe ? (localStream || rtcClientRef.current?.media.getStream()) : remoteStreams.get(p.socketId);

              return (
                <VideoTile
                  key={p.id}
                  participant={p}
                  stream={stream}
                  isLocal={isMe}
                  isActiveSpeaker={activeSpeakerSocketId === p.socketId || (isMe && activeSpeakerSocketId === 'local')}
                  isPinned={pinnedSocketId === p.socketId}
                  onTogglePin={(sId) => setPinnedSocketId(pinnedSocketId === sId ? null : sId)}
                />
              );
            })}
          </div>
        )}

        {/* Live Subtitles Overlay */}
        {isCaptionsActive && currentCaption && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-2xl glass-panel bg-black/80 text-sm text-slate-100 max-w-xl text-center shadow-xl border border-white/10 z-30">
            {currentCaption}
          </div>
        )}

        {/* Remote Mute Toast */}
        {muteToast && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-xs font-medium flex items-center space-x-3 z-50 shadow-2xl">
            <ShieldAlert className="w-4 h-4 text-yellow-400" />
            <span>{muteToast}</span>
            <button
              type="button"
              onClick={() => { toggleMic(); setMuteToast(null); }}
              className="px-2.5 py-1 rounded bg-yellow-500 text-slate-950 font-bold hover:bg-yellow-400"
            >
              Mute Mic
            </button>
          </div>
        )}
      </main>

      {/* Bottom Floating Control Bar */}
      <footer className="h-20 px-6 glass-panel border-t border-white/10 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3.5 rounded-2xl transition-all border ${
              isMuted ? 'bg-red-600 text-white border-red-500/40' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={toggleCam}
            className={`p-3.5 rounded-2xl transition-all border ${
              isCameraOff ? 'bg-red-600 text-white border-red-500/40' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        </div>

        {/* Middle Feature Buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-3.5 rounded-2xl transition-all border ${
              isScreenSharing ? 'bg-purple-600 text-white border-purple-500/40' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title="Share Screen"
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3.5 rounded-2xl transition-all border ${
              isRecording ? 'bg-red-600 text-white border-red-500/40 animate-pulse' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title="Record Meeting"
          >
            <Disc className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={toggleCaptions}
            className={`p-3.5 rounded-2xl transition-all border ${
              isCaptionsActive ? 'bg-blue-600 text-white border-blue-500/40' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title="Live Subtitles"
          >
            <Subtitles className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-3.5 rounded-2xl transition-all border ${
              isChatOpen ? 'bg-blue-600 text-white border-blue-500/40' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title="In-call Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            className={`p-3.5 rounded-2xl transition-all border ${
              isParticipantsOpen ? 'bg-blue-600 text-white border-blue-500/40' : 'glass-pill text-slate-200 hover:bg-white/10'
            }`}
            title="Participants"
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-3.5 rounded-2xl glass-pill text-slate-200 hover:bg-white/10 transition-all"
            title="Settings & Telemetry"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Leave Meeting Button */}
        <div>
          <button
            type="button"
            onClick={onLeaveMeeting}
            className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 font-semibold text-xs text-white transition-all shadow-lg shadow-red-600/20 flex items-center space-x-2"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </footer>

      {/* Drawers & Modals */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        roomId={roomId}
        currentUserId={localParticipant?.userId || ''}
        currentUserName={userName}
        messages={messages}
        files={files}
        onSendMessage={handleSendMessage}
        onUploadFile={handleFileUpload}
      />

      <ParticipantDrawer
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        participants={participantsList}
        currentUserId={localParticipant?.userId || ''}
        isHost={isHost}
        onRequestRemoteMute={(targetId) => rtcClientRef.current?.signaling.requestRemoteMute(roomId, targetId, true)}
        onRemoveParticipant={(targetId) => rtcClientRef.current?.signaling.removeParticipant(roomId, targetId)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        qualityReports={qualityReports}
      />
    </div>
  );
};
