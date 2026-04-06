import { HttpService } from '@nestjs/axios';
export interface HeartbeatPayload {
    session_id: string;
    user_id: string;
    video_id: string;
    playhead: number;
    timestamp: number;
}
export interface BatchResult {
    sent: number;
    errors: number;
}
export declare class BatchSender {
    private readonly http;
    private readonly logger;
    constructor(http: HttpService);
    sendBatch(payloads: HeartbeatPayload[], targetUrl?: string): Promise<BatchResult>;
}
