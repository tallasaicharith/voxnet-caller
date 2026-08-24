/**
 * ConnectionQualityManager
 * Evaluates WebRTC stats (RTT, packet loss, jitter, bitrate) and computes normalized connection quality.
 */

export type QualityRating = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Reconnecting';

export interface QualityReport {
  rating: QualityRating;
  rttMs: number;
  packetLossPercent: number;
  bitrateKbps: number;
  jitterMs: number;
}

export class ConnectionQualityManager {
  private intervalId: number | null = null;
  private prevBytesReceived: Map<string, { bytes: number; timestamp: number }> = new Map();
  
  public onQualityReport?: (socketId: string, report: QualityReport) => void;

  public startMonitoring(getStatsCallback: (socketId: string) => Promise<RTCStatsReport | null>, activeSocketIds: string[]) {
    this.stopMonitoring();

    this.intervalId = window.setInterval(async () => {
      for (const socketId of activeSocketIds) {
        const stats = await getStatsCallback(socketId);
        if (!stats) continue;

        const report = this.parseStats(socketId, stats);
        if (this.onQualityReport) {
          this.onQualityReport(socketId, report);
        }
      }
    }, 2500);
  }

  private parseStats(socketId: string, stats: RTCStatsReport): QualityReport {
    let rttMs = 0;
    let packetLossPercent = 0;
    let bitrateKbps = 0;
    let jitterMs = 0;

    stats.forEach((report) => {
      if (report.type === 'remote-inbound-rtp' || report.type === 'candidate-pair') {
        if (report.currentRoundTripTime) {
          rttMs = Math.round(report.currentRoundTripTime * 1000);
        }
      }

      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        if (report.jitter) {
          jitterMs = Math.round(report.jitter * 1000);
        }

        const packetsLost = report.packetsLost || 0;
        const packetsReceived = report.packetsReceived || 1;
        packetLossPercent = Math.min(100, Math.round((packetsLost / (packetsLost + packetsReceived)) * 100));

        // Bitrate calculation
        const now = report.timestamp;
        const bytes = report.bytesReceived || 0;

        if (this.prevBytesReceived.has(socketId)) {
          const prev = this.prevBytesReceived.get(socketId)!;
          const timeDiffSec = (now - prev.timestamp) / 1000;
          if (timeDiffSec > 0) {
            bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / (timeDiffSec * 1000));
          }
        }
        this.prevBytesReceived.set(socketId, { bytes, timestamp: now });
      }
    });

    // Rating Algorithm
    let rating: QualityRating = 'Excellent';

    if (rttMs > 400 || packetLossPercent > 12 || bitrateKbps < 150) {
      rating = 'Poor';
    } else if (rttMs > 250 || packetLossPercent > 6 || bitrateKbps < 350) {
      rating = 'Fair';
    } else if (rttMs > 120 || packetLossPercent > 2) {
      rating = 'Good';
    }

    return {
      rating,
      rttMs,
      packetLossPercent,
      bitrateKbps,
      jitterMs,
    };
  }

  public stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
