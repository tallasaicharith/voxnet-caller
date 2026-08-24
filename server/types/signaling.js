import { z } from 'zod';

export const CreateRoomSchema = z.object({
  title: z.string().min(1).max(100).optional().default('VoxNet Meeting'),
  userName: z.string().min(1).max(50),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().regex(/^vox-[a-z0-9]{3}-[a-z0-9]{3}$/, 'Invalid room ID format'),
  userId: z.string().uuid().optional(),
  userName: z.string().min(1).max(50),
});

export const SendMessageSchema = z.object({
  roomId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string().min(1).max(2000),
});

export const MuteRequestSchema = z.object({
  targetParticipantId: z.string(),
  mute: z.boolean(),
});

export const RemoveParticipantSchema = z.object({
  targetParticipantId: z.string(),
});
