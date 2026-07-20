import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAllowed } from 'src/auth/decorators/roles.decorator';
import { GetUser } from 'src/user/decorators/get-user.decorator';
import { Roles } from 'src/user/entities/roles.enum';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogPresenter } from './api/catalog.presenter';
import { CatalogStoresResponseDto } from './api/dto/catalog-store-response.dto';

@ApiTags('stores')
@Controller('stores')
export class CatalogStoreController {
  constructor(
    private readonly catalogQuery: CatalogQueryService,
    private readonly catalogPresenter: CatalogPresenter,
  ) {}

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get()
  @ApiOperation({ summary: '매장 전체 목록 요청' })
  @ApiQuery({
    name: 'latitude',
    description: '위도',
    required: true,
    type: Number,
  })
  @ApiQuery({
    name: 'longitude',
    description: '경도',
    required: true,
    type: Number,
  })
  @ApiQuery({
    name: 'dist',
    description: '반경 제한(미터 단위)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'after',
    description: '거리 기준 페이지네이션',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'count',
    description: '요청할 매장 개수',
    required: false,
    type: Number,
  })
  @ApiNoContentResponse({ description: '정보 없음.' })
  @ApiOkResponse({
    description: '매장 목록 요청 성공',
    type: CatalogStoresResponseDto,
  })
  getAll(
    @GetUser() user: AuthenticatedUser,
    @Query('latitude') latitude,
    @Query('longitude') longitude,
    @Query('dist') distance,
    @Query('after') after,
    @Query('count') limit,
  ) {
    return this.catalogQuery
      .findAllStores(
        parseFloat(latitude),
        parseFloat(longitude),
        parseInt(distance),
        parseFloat(after),
        parseInt(limit),
      )
      .then((page) => this.catalogPresenter.storePage(page, user.firebaseUid));
  }
}
