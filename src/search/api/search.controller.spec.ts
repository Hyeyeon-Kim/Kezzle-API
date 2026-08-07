import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/user/domain/roles.enum';
import { SearchController } from './search.controller';

describe('SearchController ownership', () => {
  it('rejects another user recent-search history', async () => {
    const searchService = { getLatest: jest.fn() };
    const controller = new SearchController(searchService as never);
    const user = {
      firebaseUid: 'user-1',
      nickname: 'user',
      oauthProvider: 'firebase',
      roles: [Roles.BUYER],
      cakeLikeIds: [],
      storeLikeIds: [],
    };

    await expect(controller.userLatest('user-2', user)).rejects.toThrow(
      ForbiddenException,
    );
    expect(searchService.getLatest).not.toHaveBeenCalled();
  });
});
