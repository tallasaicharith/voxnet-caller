import { prisma } from '../db.js';
import { JoinRoomSchema, SendMessageSchema } from '../types/signaling.js';

// In-memory active room cache for high-speed socket signaling
const activeRooms = new Map();
// Key: socketId, Value: { roomId, participantId, userId }
const socketParticipantMap = new Map();

export function setupSignalingHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    /**
     * Join Room Event
     */
    socket.on('room:join', async (payload, callback) => {
      try {
        const validation = JoinRoomSchema.safeParse(payload);
        if (!validation.success) {
          return callback({ success: false, error: 'Invalid room join payload' });
        }

        const { roomId, userId: inputUserId, userName } = validation.data;

        // Verify room in database
        const meeting = await prisma.meeting.findUnique({
          where: { id: roomId },
          include: { participants: { where: { leftAt: null } } }
        });

        if (!meeting) {
          return callback({ success: false, error: 'Meeting not found' });
        }

        if (meeting.isLocked) {
          return callback({ success: false, error: 'This meeting is locked by the host' });
        }

        // Handle User identity
        let userId = inputUserId;
        if (!userId) {
          const newUser = await prisma.user.create({ data: { name: userName } });
          userId = newUser.id;
        }

        // Determine if user is host
        const isHost = meeting.hostId === userId || meeting.participants.length === 0;
        const role = isHost ? 'HOST' : 'PARTICIPANT';

        // Check if participant already exists in DB
        let participant = await prisma.meetingParticipant.findFirst({
          where: { meetingId: roomId, userId, leftAt: null }
        });

        if (!participant) {
          participant = await prisma.meetingParticipant.create({
            data: {
              meetingId: roomId,
              userId: userId,
              name: userName,
              role: role,
            }
          });
        }

        // Create MeetingSession in DB
        await prisma.meetingSession.create({
          data: {
            participantId: participant.id,
            socketId: socket.id,
            status: 'ACTIVE',
          }
        });

        // Track socket mapping
        socketParticipantMap.set(socket.id, { roomId, participantId: participant.id, userId });
        socket.join(roomId);

        // Update activeRooms memory cache
        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, {
            id: roomId,
            title: meeting.title,
            hostId: meeting.hostId,
            isLocked: meeting.isLocked,
            createdAt: meeting.createdAt.toISOString(),
            participants: new Map(),
          });
        }

        const roomCache = activeRooms.get(roomId);

        const newParticipantState = {
          id: participant.id,
          userId: userId,
          socketId: socket.id,
          name: userName,
          role: role,
          isMuted: participant.isMuted,
          isCameraOff: participant.isCameraOff,
          isScreenSharing: false,
          isSpeaking: false,
          isPinned: false,
          isSpotlighted: false,
          connectionQuality: 'Excellent',
          joinedAt: participant.joinedAt.toISOString(),
        };

        roomCache.participants.set(socket.id, newParticipantState);

        // Notify room participants
        const participantsArray = Array.from(roomCache.participants.values());

        const fullRoomState = {
          id: roomId,
          title: roomCache.title,
          hostId: roomCache.hostId,
          isLocked: roomCache.isLocked,
          createdAt: roomCache.createdAt,
          participants: participantsArray,
        };

        // Notify joiner with initial room state
        callback({
          success: true,
          room: fullRoomState,
          participantId: participant.id,
        });

        // Broadcast participant:joined to everyone else in the room
        socket.to(roomId).emit('participant:joined', newParticipantState);

      } catch (error) {
        console.error('Error handling room:join:', error);
        callback({ success: false, error: 'Internal server error while joining room' });
      }
    });

    /**
     * WebRTC Signal Relay (SDP offer/answer, ICE candidates)
     */
    socket.on('webrtc:signal', (payload) => {
      const { targetSocketId, signal, type } = payload;
      if (!targetSocketId) return;

      io.to(targetSocketId).emit('webrtc:signal', {
        targetSocketId,
        senderSocketId: socket.id,
        signal,
        type,
      });
    });

    /**
     * Media State Update (Mic/Cam/Screen Share state changes)
     */
    socket.on('media:state-update', (payload) => {
      const mapping = socketParticipantMap.get(socket.id);
      if (!mapping) return;

      const { roomId } = mapping;
      const roomCache = activeRooms.get(roomId);
      if (roomCache && roomCache.participants.has(socket.id)) {
        const participantState = roomCache.participants.get(socket.id);

        if (typeof payload.isMuted === 'boolean') participantState.isMuted = payload.isMuted;
        if (typeof payload.isCameraOff === 'boolean') participantState.isCameraOff = payload.isCameraOff;
        if (typeof payload.isScreenSharing === 'boolean') participantState.isScreenSharing = payload.isScreenSharing;

        // Broadcast media change to all peers in room
        io.in(roomId).emit('participant:media-changed', {
          roomId,
          participantId: participantState.id,
          isMuted: participantState.isMuted,
          isCameraOff: participantState.isCameraOff,
          isScreenSharing: participantState.isScreenSharing,
        });
      }
    });

    /**
     * Persistent Real-Time Chat Sending
     */
    socket.on('chat:send', async (payload) => {
      try {
        const validation = SendMessageSchema.safeParse(payload);
        if (!validation.success) return;

        const { roomId, senderId, senderName, content } = validation.data;

        // Store message in database
        const savedMessage = await prisma.chatMessage.create({
          data: {
            meetingId: roomId,
            senderId,
            senderName,
            content,
          }
        });

        const chatPayload = {
          id: savedMessage.id,
          roomId,
          senderId,
          senderName,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt.toISOString(),
        };

        // Broadcast chat message to entire room
        io.in(roomId).emit('chat:message', chatPayload);
      } catch (error) {
        console.error('Error in chat:send:', error);
      }
    });

    /**
     * Host Remote Mute Request
     */
    socket.on('host:request-mute', async ({ roomId, targetParticipantId, mute }) => {
      const mapping = socketParticipantMap.get(socket.id);
      if (!mapping) return;

      // Verify sender is host
      const roomCache = activeRooms.get(roomId);
      if (!roomCache) return;

      const senderState = roomCache.participants.get(socket.id);
      if (!senderState || senderState.role !== 'HOST') return;

      // Find target socket
      for (const [targetSocketId, pState] of roomCache.participants.entries()) {
        if (pState.id === targetParticipantId) {
          io.to(targetSocketId).emit('host:mute-request', {
            targetParticipantId,
            mute,
            requestedBy: senderState.name,
          });
          break;
        }
      }
    });

    /**
     * Host Remove Participant
     */
    socket.on('host:remove-participant', async ({ roomId, targetParticipantId }) => {
      const mapping = socketParticipantMap.get(socket.id);
      if (!mapping) return;

      const roomCache = activeRooms.get(roomId);
      if (!roomCache) return;

      const senderState = roomCache.participants.get(socket.id);
      if (!senderState || senderState.role !== 'HOST') return;

      for (const [targetSocketId, pState] of roomCache.participants.entries()) {
        if (pState.id === targetParticipantId) {
          io.to(targetSocketId).emit('host:removed', 'Removed by host');
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.leave(roomId);
          }
          roomCache.participants.delete(targetSocketId);
          io.in(roomId).emit('participant:left', targetParticipantId);
          break;
        }
      }
    });

    /**
     * Connection Quality Report
     */
    socket.on('connection:report-stats', (payload) => {
      const mapping = socketParticipantMap.get(socket.id);
      if (!mapping) return;

      const { roomId } = mapping;
      const roomCache = activeRooms.get(roomId);
      if (roomCache && roomCache.participants.has(socket.id)) {
        const participantState = roomCache.participants.get(socket.id);
        participantState.connectionQuality = payload.quality;

        io.in(roomId).emit('connection:quality-update', {
          roomId,
          participantId: participantState.id,
          quality: payload.quality,
          stats: payload.stats,
        });
      }
    });

    /**
     * Disconnect Handling
     */
    socket.on('disconnect', async () => {
      console.log(`[Socket Disconnected] ID: ${socket.id}`);
      const mapping = socketParticipantMap.get(socket.id);

      if (mapping) {
        const { roomId, participantId } = mapping;
        socketParticipantMap.delete(socket.id);

        // Update DB session and participant leftAt
        try {
          await prisma.meetingSession.updateMany({
            where: { socketId: socket.id, status: 'ACTIVE' },
            data: { disconnectedAt: new Date(), status: 'DISCONNECTED' }
          });
          if (participantId) {
            await prisma.meetingParticipant.update({
              where: { id: participantId },
              data: { leftAt: new Date() }
            });
          }
        } catch (e) {
          console.warn('Failed to update session disconnect:', e);
        }

        const roomCache = activeRooms.get(roomId);
        if (roomCache) {
          roomCache.participants.delete(socket.id);
          io.in(roomId).emit('participant:left', participantId);

          if (roomCache.participants.size === 0) {
            activeRooms.delete(roomId);
          }
        }
      }
    });
  });
}
