import fs from 'fs';
import path from 'path';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultDbPath = isServerless ? '/tmp/dev.db.json' : './dev.db.json';
const DB_FILE = path.resolve(process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('file:', '') : defaultDbPath);

// Memory store backed by file sync
let dbData = {
  users: [],
  meetings: [],
  participants: [],
  sessions: [],
  messages: [],
  files: [],
  recordings: [],
  events: []
};

// Load existing data
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    dbData = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse db file, initializing clean store:', e);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch (e) {
    console.error('Error persisting database:', e);
  }
}

export const prisma = {
  user: {
    create: async ({ data }) => {
      const newUser = {
        id: data.id || `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        email: data.email || null,
        avatar: data.avatar || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbData.users.push(newUser);
      saveDb();
      return newUser;
    },
    findUnique: async ({ where }) => {
      return dbData.users.find(u => u.id === where.id || u.email === where.email) || null;
    }
  },
  meeting: {
    create: async ({ data }) => {
      const newMeeting = {
        id: data.id,
        title: data.title || 'VoxNet Meeting',
        hostId: data.hostId,
        isLocked: data.isLocked || false,
        createdAt: new Date(),
        endedAt: null,
      };
      dbData.meetings.push(newMeeting);
      saveDb();
      return newMeeting;
    },
    findUnique: async ({ where }) => {
      const meeting = dbData.meetings.find(m => m.id === where.id);
      if (!meeting) return null;

      const participants = dbData.participants.filter(p => p.meetingId === meeting.id);
      const messages = dbData.messages.filter(m => m.meetingId === meeting.id);
      const files = dbData.files.filter(f => f.meetingId === meeting.id);

      return {
        ...meeting,
        participants,
        messages,
        files
      };
    },
    findMany: async () => dbData.meetings,
    update: async ({ where, data }) => {
      const index = dbData.meetings.findIndex(m => m.id === where.id);
      if (index !== -1) {
        dbData.meetings[index] = { ...dbData.meetings[index], ...data };
        saveDb();
        return dbData.meetings[index];
      }
      return null;
    }
  },
  meetingParticipant: {
    create: async ({ data }) => {
      const newParticipant = {
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        meetingId: data.meetingId,
        userId: data.userId,
        name: data.name,
        role: data.role || 'PARTICIPANT',
        isMuted: data.isMuted || false,
        isCameraOff: data.isCameraOff || false,
        joinedAt: new Date(),
        leftAt: null,
      };
      dbData.participants.push(newParticipant);
      saveDb();
      return newParticipant;
    },
    findFirst: async ({ where }) => {
      return dbData.participants.find(p => p.meetingId === where.meetingId && p.userId === where.userId && (where.leftAt === null ? p.leftAt === null : true)) || null;
    },
    update: async ({ where, data }) => {
      const p = dbData.participants.find(pt => pt.id === where.id);
      if (p) {
        Object.assign(p, data);
        saveDb();
        return p;
      }
      return null;
    }
  },
  meetingSession: {
    create: async ({ data }) => {
      const newSession = {
        id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        participantId: data.participantId,
        socketId: data.socketId,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        connectedAt: new Date(),
        disconnectedAt: null,
        status: data.status || 'ACTIVE',
      };
      dbData.sessions.push(newSession);
      saveDb();
      return newSession;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      dbData.sessions.forEach(s => {
        if (s.socketId === where.socketId && s.status === where.status) {
          Object.assign(s, data);
          count++;
        }
      });
      saveDb();
      return { count };
    }
  },
  chatMessage: {
    create: async ({ data }) => {
      const newMsg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        meetingId: data.meetingId,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        createdAt: new Date(),
      };
      dbData.messages.push(newMsg);
      saveDb();
      return newMsg;
    },
    findMany: async ({ where }) => {
      return dbData.messages.filter(m => m.meetingId === where.meetingId);
    }
  },
  fileAsset: {
    create: async ({ data }) => {
      const newFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        meetingId: data.meetingId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        size: data.size,
        storageKey: data.storageKey,
        uploadedBy: data.uploadedBy,
        createdAt: new Date(),
      };
      dbData.files.push(newFile);
      saveDb();
      return newFile;
    }
  }
};
