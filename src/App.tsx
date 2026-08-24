import React, { useEffect, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { PreJoinLobby } from './components/PreJoinLobby';
import { MeetingRoom } from './components/MeetingRoom';
import { NotFoundScreen } from './components/NotFoundScreen';

export function App() {
  const [viewState, setViewState] = useState<'landing' | 'lobby' | 'room' | 'not_found'>('landing');
  const [roomId, setRoomId] = useState<string>('');
  const [roomTitle, setRoomTitle] = useState<string>('VoxNet Meeting');
  const [userName, setUserName] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/room\/([a-z0-9-]+)$/i);

    if (match) {
      const targetRoomId = match[1];
      setRoomId(targetRoomId);

      // Validate room existence with backend
      fetch(`/api/rooms/${targetRoomId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.room) {
            setRoomTitle(data.room.title);
            setViewState('lobby');
          } else {
            setViewState('not_found');
          }
        })
        .catch(() => setViewState('not_found'));
    } else {
      setViewState('landing');
    }
  }, []);

  const handleCreateRoom = async (title: string, name: string) => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, userName: name }),
      });
      const data = await res.json();

      if (data.success && data.room) {
        setRoomId(data.room.id);
        setRoomTitle(data.room.title);
        setUserName(name);
        window.history.pushState({}, '', `/room/${data.room.id}`);
        setViewState('lobby');
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleJoinRoomFromLanding = async (targetRoomId: string, name: string) => {
    try {
      const res = await fetch(`/api/rooms/${targetRoomId}`);
      const data = await res.json();

      if (data.success && data.room) {
        setRoomId(targetRoomId);
        setRoomTitle(data.room.title);
        setUserName(name);
        window.history.pushState({}, '', `/room/${targetRoomId}`);
        setViewState('lobby');
      } else {
        setViewState('not_found');
      }
    } catch (err) {
      setViewState('not_found');
    }
  };

  const handleJoinMeetingFromLobby = (finalName: string, muted: boolean, cameraOff: boolean) => {
    setUserName(finalName);
    setIsMuted(muted);
    setIsCameraOff(cameraOff);
    setViewState('room');
  };

  const handleLeaveMeeting = () => {
    window.history.pushState({}, '', '/');
    setViewState('landing');
  };

  if (viewState === 'not_found') {
    return <NotFoundScreen onReturnHome={handleLeaveMeeting} />;
  }

  if (viewState === 'lobby') {
    return (
      <PreJoinLobby
        roomId={roomId}
        roomTitle={roomTitle}
        userName={userName}
        onJoinMeeting={handleJoinMeetingFromLobby}
      />
    );
  }

  if (viewState === 'room') {
    return (
      <MeetingRoom
        roomId={roomId}
        userName={userName}
        initialMuted={isMuted}
        initialCameraOff={isCameraOff}
        onLeaveMeeting={handleLeaveMeeting}
      />
    );
  }

  return (
    <LandingPage
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoomFromLanding}
    />
  );
}

export default App;
