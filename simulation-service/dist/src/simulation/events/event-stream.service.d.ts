export interface StreamEvent {
    userId: string;
    videoId: string;
    timestamp: number;
}
export declare class EventStreamService {
    private events;
    push(userId: string, videoId: string): void;
    pushBatch(payloads: Array<{
        user_id: string;
        video_id: string;
    }>): void;
    getEvents(): StreamEvent[];
}
