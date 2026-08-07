import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from 'src/modules/search/application/search.service';
import { GetUser } from 'src/platform/auth/decorators/get-user.decorator';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { assertSelfOrAdmin } from 'src/platform/auth/authorization/self-or-admin';
import { SearchPresenter } from './search.presenter';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async cakeSearch(
    @Query('keyword') keywords: string,
    @Query('page') page,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    return SearchPresenter.result(
      await this.searchService.search(
        keywords,
        parseInt(page),
        userDto.firebaseUid,
      ),
      userDto.firebaseUid,
    );
  }

  @Get(':id')
  async userLatest(
    @Param('id') userId: string,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    assertSelfOrAdmin(userDto, userId);
    return SearchPresenter.latest(await this.searchService.getLatest(userId));
  }
}
