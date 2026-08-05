import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/platform/auth/decorators/public.decorator';
import { RolesAllowed } from 'src/platform/auth/decorators/roles.decorator';
import { Roles } from 'src/modules/user/application/roles.enum';
import { RankingPresenter } from './ranking.presenter';
import { RankingQueryService } from '../application/ranking-query.service';

@Controller()
export class RankingController {
  constructor(private readonly rankingQuery: RankingQueryService) {}

  @ApiTags('search')
  @Get('search/rank')
  @Public()
  async keywordRank(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return RankingPresenter.keyword(
      await this.rankingQuery.getKeywordRank(startDate, endDate),
    );
  }

  @ApiTags('cakes')
  @ApiBearerAuth()
  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes/popular')
  async cakePopular(
    @Query('after') after: string,
    @Query('limit') limit: string,
  ) {
    return RankingPresenter.popular(
      await this.rankingQuery.getPopularCakes(
        parseFloat(after),
        parseInt(limit),
      ),
    );
  }
}
