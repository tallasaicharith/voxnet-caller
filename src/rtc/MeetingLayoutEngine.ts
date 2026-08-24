export interface LayoutConfig {
  gridColumns: number;
  gridRows: number;
  isScreenShareActive: boolean;
  featuredParticipantId: string | null; // Pinned or Spotlighted
}

export class MeetingLayoutEngine {
  public static calculateLayout(
    participantCount: number,
    hasScreenShare: boolean,
    pinnedSocketId: string | null,
    spotlightSocketId: string | null,
    activeSpeakerId: string | null
  ): LayoutConfig {
    const featuredParticipantId = spotlightSocketId || pinnedSocketId || (participantCount > 2 ? activeSpeakerId : null);

    if (hasScreenShare || featuredParticipantId) {
      return {
        gridColumns: 1,
        gridRows: 1,
        isScreenShareActive: hasScreenShare,
        featuredParticipantId,
      };
    }

    if (participantCount <= 1) {
      return { gridColumns: 1, gridRows: 1, isScreenShareActive: false, featuredParticipantId: null };
    } else if (participantCount === 2) {
      return { gridColumns: 2, gridRows: 1, isScreenShareActive: false, featuredParticipantId: null };
    } else if (participantCount <= 4) {
      return { gridColumns: 2, gridRows: 2, isScreenShareActive: false, featuredParticipantId: null };
    } else if (participantCount <= 9) {
      return { gridColumns: 3, gridRows: 3, isScreenShareActive: false, featuredParticipantId: null };
    } else {
      return { gridColumns: 4, gridRows: Math.ceil(participantCount / 4), isScreenShareActive: false, featuredParticipantId: null };
    }
  }
}
