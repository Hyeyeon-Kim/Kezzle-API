import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/user/entities/roles.enum';
import { SearchController } from './search.controller';

describe('SearchController ownership', () => {
  it('rejects another user recent-search history', async () => {
    const searchService = { getLatest: jest.fn() };
    const controller = new SearchController(searchService as never);
    const user = {
      firebaseUid: 'user-1',
      nickname: 'user',
      oauth_provider: 'firebase',
      roles: [Roles.BUYER],
      cake_like_ids: [],
      store_like_ids: [],
    };

    await expect(controller.userLatest('user-2', user)).rejects.toThrow(
      ForbiddenException,
    );
    expect(searchService.getLatest).not.toHaveBeenCalled();
  });
});
