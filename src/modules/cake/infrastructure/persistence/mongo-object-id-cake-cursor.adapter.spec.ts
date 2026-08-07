import { MongoObjectIdCakeCursorAdapter } from './mongo-object-id-cake-cursor.adapter';

describe('MongoObjectIdCakeCursorAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('preserves the legacy random-prefix and ObjectId-time cursor format', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1234);
    const earliestTimestamp = Math.floor(Date.now() / 1000) * 1000;

    const cursor = new MongoObjectIdCakeCursorAdapter().generate();

    const latestTimestamp = Math.floor(Date.now() / 1000) * 1000;
    expect(cursor).toHaveLength(21);
    expect(cursor.slice(0, 6)).toBe('001234');
    expect(Number(cursor.slice(6))).toBeGreaterThanOrEqual(earliestTimestamp);
    expect(Number(cursor.slice(6))).toBeLessThanOrEqual(latestTimestamp);
  });
});
