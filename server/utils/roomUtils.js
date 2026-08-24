import crypto from 'crypto';
import { prisma } from '../db.js';

/**
 * Generates a cryptographically secure, human-readable Room ID (e.g., vox-k7x-92p)
 */
export async function generateSecureRoomId() {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let isUnique = false;
  let roomId = '';

  while (!isUnique) {
    const bytes = crypto.randomBytes(6);
    let part1 = '';
    let part2 = '';

    for (let i = 0; i < 3; i++) {
      part1 += characters[bytes[i] % characters.length];
    }
    for (let i = 3; i < 6; i++) {
      part2 += characters[bytes[i] % characters.length];
    }

    roomId = `vox-${part1}-${part2}`;

    // Verify uniqueness in database
    const existing = await prisma.meeting.findUnique({
      where: { id: roomId },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return roomId;
}
