export abstract class CounterSequencePort {
  abstract getNextSequenceValue(sequenceName: string): Promise<number>;
}
