import { AnniversaryPersistenceMapper } from './anniversary.persistence-mapper';

describe('AnniversaryPersistenceMapper', () => {
  it('maps the persistence document to a pure view', () => {
    const date = new Date('2026-11-11T00:00:00.000Z');

    expect(
      AnniversaryPersistenceMapper.toView({
        _id: { toString: () => 'anniversary-1' },
        name: '기념일',
        keyword: ['기념일', '케이크'],
        date,
        ment: '기념일 케이크',
      }),
    ).toEqual({
      id: 'anniversary-1',
      name: '기념일',
      keyword: ['기념일', '케이크'],
      date,
      mention: '기념일 케이크',
    });
  });
});
