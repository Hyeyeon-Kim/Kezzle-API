import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowHomeResilienceAuthBypass } from 'src/auth/decorators/home-resilience-auth-bypass.decorator';
import { RolesAllowed } from 'src/auth/decorators/roles.decorator';
import { Roles } from 'src/user/domain/roles.enum';
import { GetUser } from 'src/user/api/decorator/get-user.decorator';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { HomeFeedService } from '../application/home-feed.service';
import { HomeFeedResponseDto } from './dto/home-feed.response.dto';
import { HomePresenter } from './home.presenter';

@ApiTags('curation')
@ApiBearerAuth()
@Controller('curation')
export class HomeController {
  constructor(
    private readonly homeFeedService: HomeFeedService,
    private readonly homePresenter: HomePresenter,
  ) {}

  @ApiOkResponse({
    description: '홈 화면 정보들을 반환합니다.',
    type: HomeFeedResponseDto,
  })
  @Get()
  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @AllowHomeResilienceAuthBypass()
  getHome(@GetUser() user: AuthenticatedUser) {
    return this.homeFeedService
      .getHome(user)
      .then((home) => this.homePresenter.response(home));
  }
}
