import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowHomeResilienceAuthBypass } from 'src/platform/auth/decorators/home-resilience-auth-bypass.decorator';
import { RolesAllowed } from 'src/platform/auth/decorators/roles.decorator';
import { Roles } from 'src/modules/user/entities/roles.enum';
import { GetUser } from 'src/modules/user/decorators/get-user.decorator';
import { AuthenticatedUser } from 'src/modules/user/application/authenticated-user';
import { HomePresenter } from './api/home.presenter';
import { HomeResponseDto } from './api/dto/home-response.dto';
import { HomeFeedService } from './home-feed.service';

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
    type: HomeResponseDto,
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
