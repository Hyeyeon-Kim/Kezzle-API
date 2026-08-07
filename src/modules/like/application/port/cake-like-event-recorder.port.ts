export abstract class CakeLikeEventRecorder {
  abstract record(userId: string, cakeId: string, type: boolean): Promise<void>;
}
