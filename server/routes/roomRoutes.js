import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db.js';
import { generateSecureRoomId } from '../utils/roomUtils.js';

const router = Router();

// Configure Multer for File Uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// File Security: 25MB max size, restricted executable MIME types
const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const dangerousMimeTypes = ['application/x-msdownload', 'application/x-executable', 'application/x-sh'];
    if (dangerousMimeTypes.includes(file.mimetype)) {
      return cb(new Error('File type not allowed for security reasons.'), false);
    }
    cb(null, true);
  }
});

/**
 * POST /api/rooms
 * Creates a new meeting room in the database with a cryptographically secure ID
 */
router.post('/rooms', async (req, res) => {
  try {
    const { title, userName } = req.body;
    const roomId = await generateSecureRoomId();
    
    // Create host user if not provided
    const user = await prisma.user.create({
      data: {
        name: userName || 'Host User',
      }
    });

    const meeting = await prisma.meeting.create({
      data: {
        id: roomId,
        title: title || 'VoxNet Meeting',
        hostId: user.id,
      }
    });

    res.status(201).json({
      success: true,
      room: {
        id: meeting.id,
        title: meeting.title,
        hostId: meeting.hostId,
        createdAt: meeting.createdAt,
        shareUrl: `${req.protocol}://${req.get('host')}/room/${meeting.id}`,
      },
      user: {
        id: user.id,
        name: user.name,
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

/**
 * GET /api/rooms/:id
 * Fetches room metadata and validates room existence
 */
router.get('/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        participants: {
          where: { leftAt: null },
          include: { sessions: { where: { status: 'ACTIVE' } } }
        }
      }
    });

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    res.json({
      success: true,
      room: {
        id: meeting.id,
        title: meeting.title,
        hostId: meeting.hostId,
        isLocked: meeting.isLocked,
        createdAt: meeting.createdAt,
        activeParticipantCount: meeting.participants.length,
      }
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch room' });
  }
});

/**
 * GET /api/rooms/:id/messages
 * Fetches chat message history for a meeting
 */
router.get('/rooms/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await prisma.chatMessage.findMany({
      where: { meetingId: id },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/rooms/:id/upload
 * Handles file attachment uploads with metadata persistence
 */
router.post('/rooms/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { uploadedBy } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Verify room exists
    const meeting = await prisma.meeting.findUnique({ where: { id: roomId } });
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const fileAsset = await prisma.fileAsset.create({
      data: {
        meetingId: roomId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storageKey: req.file.filename,
        uploadedBy: uploadedBy || 'Anonymous',
      }
    });

    const fileUrl = `/uploads/${req.file.filename}`;

    res.status(201).json({
      success: true,
      file: {
        id: fileAsset.id,
        roomId: fileAsset.meetingId,
        fileName: fileAsset.fileName,
        mimeType: fileAsset.mimeType,
        size: fileAsset.size,
        url: fileUrl,
        uploadedBy: fileAsset.uploadedBy,
        createdAt: fileAsset.createdAt,
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: error.message || 'File upload failed' });
  }
});

export default router;
