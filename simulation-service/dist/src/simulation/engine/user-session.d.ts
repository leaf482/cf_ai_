export interface UserSession {
    userId: string;
    sessionId: string;
    videoId: string;
    watchDurationMs: number;
    playheadMs: number;
    lastHeartbeatAt: number;
    heartbeatIntervalMs: number;
    nextHeartbeatDueAt: number;
}
export interface NewSessionInput {
    userId: string;
    videoId: string;
    watchDurationMs: number;
    nowMs: number;
    heartbeatIntervalMs: number;
    sessionPrefix?: string;
}
export declare function createUserSession(input: NewSessionInput): UserSession;
