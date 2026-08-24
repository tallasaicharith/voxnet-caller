import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Settings, User, CheckCircle2 } from 'lucide-react';
import { MediaManager } from '../rtc/MediaManager';

interface PreJoinLobbyProps {
  roomId: string;
  roomTitle: string;
  userName: string;
  onJoinMeeting: (userName: string, isMuted: boolean, isCameraOff: boolean) => void;
}

export const PreJoinLobby: React.FC<PreJoinLobbyProps> = ({
  roomId,
  roomTitle,
  userName: initialUserName,
  onJoinMeeting
}) => {
  const [userName, setUserName] = useState(initialUserName);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const [devices, setDevices] = useState<{ microphones: MediaDeviceInfo[]; cameras: MediaDeviceInfo[] }>({
    microphones: [],
    cameras: [],
  });
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedCam, setSelectedCam] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaManagerRef = useRef<MediaManager | null>(null);

  useEffect(() => {
    const manager = new MediaManager();
    mediaManagerRef.current = manager;

    manager.onVolumeLevelChange = (lvl) => {
      setVolumeLevel(lvl);
    };

    const initMedia = async () => {
      try {
        const stream = await manager.getLocalMedia();
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const dev = await manager.enumerateDevices();
        setDevices({ microphones: dev.microphones, cameras: dev.cameras });

        if (dev.microphones.length > 0) setSelectedMic(dev.microphones[0].deviceId);
        if (dev.cameras.length > 0) setSelectedCam(dev.cameras[0].deviceId);
      } catch (err) {
        console.error('Lobby media preview error:', err);
      }
    };

    initMedia();

    return () => {
      manager.cleanup();
    };
  }, []);

  const handleDeviceChange = async (micId?: string, camId?: string) => {
    if (!mediaManagerRef.current) return;
    try {
      const stream = await mediaManagerRef.current.getLocalMedia(micId || selectedMic, camId || selectedCam);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('Device change error:', e);
    }
  };

  const toggleMic = () => {
    if (mediaManagerRef.current) {
      const newState = mediaManagerRef.current.toggleMicrophone();
      setIsMicEnabled(newState);
    }
  };

  const toggleCam = () => {
    if (mediaManagerRef.current) {
      const newState = mediaManagerRef.current.toggleCamera();
      setIsCamEnabled(newState);
    }
  };

  const handleJoin = () => {
    onJoinMeeting(userName, !isMicEnabled, !isCamEnabled);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#08090C] text-slate-100 p-6 overflow-hidden">
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />

      <div className="relative z-10 max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Video Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl flex items-center justify-center bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${isCamEnabled ? 'opacity-100' : 'opacity-0'}`}
            />

            {!isCamEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3">
                <div className="w-20 h-20 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400">
                  <User className="w-10 h-10" />
                </div>
                <span className="text-xs text-slate-400 font-medium">Camera is off</span>
              </div>
            )}

            {/* Bottom Overlay Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
              {/* Mic Volume Level Bar */}
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg glass-pill bg-black/40 text-xs text-slate-300">
                <Mic className={`w-3.5 h-3.5 ${isMicEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${isMicEnabled ? volumeLevel : 0}%` }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-3 rounded-xl transition-all border ${isMicEnabled ? 'bg-slate-800/80 hover:bg-slate-700 text-white border-white/10' : 'bg-red-600/80 text-white border-red-500/30'}`}
                >
                  {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCam}
                  className={`p-3 rounded-xl transition-all border ${isCamEnabled ? 'bg-slate-800/80 hover:bg-slate-700 text-white border-white/10' : 'bg-red-600/80 text-white border-red-500/30'}`}
                >
                  {isCamEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Devices Selectors */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Microphone</label>
              <select
                value={selectedMic}
                onChange={(e) => { setSelectedMic(e.target.value); handleDeviceChange(e.target.value, undefined); }}
                className="w-full px-3 py-2 rounded-lg glass-input text-slate-200 focus:outline-none"
              >
                {devices.microphones.map(m => <option key={m.deviceId} value={m.deviceId} className="bg-slate-900">{m.label || 'Microphone'}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Camera</label>
              <select
                value={selectedCam}
                onChange={(e) => { setSelectedCam(e.target.value); handleDeviceChange(undefined, e.target.value); }}
                className="w-full px-3 py-2 rounded-lg glass-input text-slate-200 focus:outline-none"
              >
                {devices.cameras.map(c => <option key={c.deviceId} value={c.deviceId} className="bg-slate-900">{c.label || 'Camera'}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Join Setup Form */}
        <div className="lg:col-span-5">
          <div className="glass-panel p-8 rounded-2xl border border-white/10 space-y-6">
            <div className="space-y-1">
              <div className="text-xs text-blue-400 font-semibold tracking-wider uppercase">Ready to join</div>
              <h2 className="text-2xl font-bold text-white">{roomTitle}</h2>
              <p className="text-xs text-slate-400">Room Code: <span className="font-mono text-slate-200">{roomId}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm focus:outline-none"
                  placeholder="Enter your name"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-2 text-xs text-slate-300">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">WebRTC Connection Ready</span>
                </div>
                <p className="text-[11px] text-slate-400">Your camera & mic settings will be applied automatically when joining.</p>
              </div>

              <button
                type="button"
                disabled={!userName.trim()}
                onClick={handleJoin}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-semibold text-sm text-white transition-all shadow-lg shadow-blue-600/20"
              >
                Join Meeting Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
