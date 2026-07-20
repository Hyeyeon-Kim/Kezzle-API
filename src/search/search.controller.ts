import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { GetUser } from 'src/user/decorators/get-user.decorator';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { Public } from 'src/auth/decorators/public.decorator';
import { assertSelfOrAdmin } from 'src/auth/authorization/self-or-admin';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async cakeSearch(
    @Query('keyword') keywords: string,
    @Query('page') page,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    return await this.searchService.search(keywords, parseInt(page), userDto);
  }

  @Get('rank')
  @Public()
  async keywordRank(@Query('startDate') startDate, @Query('endDate') endDate) {
    return await this.searchService.getRank(startDate, endDate);
  }

  @Get(':id')
  async userLatest(
    @Param('id') userId: string,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    assertSelfOrAdmin(userDto, userId);
    return await this.searchService.getLatest(userId);
  }
}
