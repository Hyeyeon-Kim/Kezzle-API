import { CurationRepository } from './curation.repository';

describe('CurationRepository', () => {
  it('claims refresh without changing timestamps', async () => {
    const lean = jest.fn().mockResolvedValue({ _id: 'cur-1' });
    const findOneAndUpdate = jest.fn().mockReturnValue({ lean });
    const repository = new CurationRepository({ findOneAndUpdate } as never);
    const updatedAt = new Date('2026-07-01T00:00:00.000Z');
    const claimedBefore = new Date('2026-07-20T00:00:00.000Z');
    const claimedAt = new Date('2026-07-20T00:10:00.000Z');

    await expect(
      repository.claimRefresh('cur-1', updatedAt, claimedBefore, claimedAt),
    ).resolves.toBe(true);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'cur-1',
        updatedAt,
        $or: [
          { refreshClaimedAt: { $exists: false } },
          { refreshClaimedAt: null },
          { refreshClaimedAt: { $lt: claimedBefore } },
        ],
      },
      { $set: { refreshClaimedAt: claimedAt } },
      { timestamps: false },
    );
  });
});
