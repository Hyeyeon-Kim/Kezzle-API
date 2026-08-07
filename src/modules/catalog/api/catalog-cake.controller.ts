import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolesAllowed } from 'src/platform/auth/decorators/roles.decorator';
import { GetUser } from 'src/platform/auth/decorators/get-user.decorator';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { Roles } from 'src/platform/auth/roles.enum';
import { CatalogQueryService } from 'src/modules/catalog/application/query/catalog-query.service';
import { CatalogPresenter } from 'src/modules/catalog/api/catalog.presenter';
import { CatalogCakesResponseDto } from 'src/modules/catalog/api/dto/response/catalog-cake-response.dto';
import { SimilarCakeCatalogQueryService } from 'src/modules/catalog/application/query/similar-cake-catalog-query.service';

@ApiTags('cakes')
@ApiBearerAuth()
@Controller()
export class CatalogCakeController {
  constructor(
    private readonly catalogQuery: CatalogQueryService,
    private readonly similarCakeQuery: SimilarCakeCatalogQueryService,
    private readonly catalogPresenter: CatalogPresenter,
  ) {}

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes')
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
    description: 'cursor 기준 페이지네이션',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'count',
    description: '요청할 케이크 개수',
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: '케이크 목록 요청 성공',
    type: CatalogCakesResponseDto,
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
      .findAllCakes(
        parseFloat(latitude),
        parseFloat(longitude),
        parseInt(distance),
        after,
        parseInt(limit),
      )
      .then((page) => this.catalogPresenter.cakePage(page, user.firebaseUid));
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes/location')
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
    description: 'ID 기준 페이지네이션',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'count',
    description: '요청할 케이크 개수',
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: '케이크 목록 요청 성공',
    type: CatalogCakesResponseDto,
  })
  getAllByLocation(
    @GetUser() user: AuthenticatedUser,
    @Query('latitude') latitude,
    @Query('longitude') longitude,
    @Query('dist') distance,
    @Query('after') after,
    @Query('count') limit,
  ) {
    return this.catalogQuery
      .findAllCakesByLocation(
        parseFloat(latitude),
        parseFloat(longitude),
        parseInt(distance),
        after,
        parseInt(limit),
      )
      .then((page) => this.catalogPresenter.cakePage(page, user.firebaseUid));
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes/:id/similar')
  cakeSimilar(
    @Param('id') cakeId: string,
    @Query('latitude') latitude,
    @Query('longitude') longitude,
    @Query('dist') distance,
    @Query('size') size,
  ) {
    return this.similarCakeQuery
      .execute(
        cakeId,
        parseFloat(longitude),
        parseFloat(latitude),
        parseInt(distance),
        parseInt(size),
      )
      .then((page) => this.catalogPresenter.similarCakes(page));
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('stores/:id/cakes')
  @ApiOperation({ summary: '매장의 케이크 전체 정보 요청' })
  @ApiParam({ name: 'id', description: '매장 ID' })
  @ApiOkResponse({
    description: '케이크 정보 요청 성공',
    type: CatalogCakesResponseDto,
  })
  @ApiNotFoundResponse({ description: '케이크를 찾을 수 없습니다.' })
  getStoreCake(
    @Param('id') storeId: string,
    @GetUser() user: AuthenticatedUser,
    @Query('after') after,
    @Query('count') limit,
  ) {
    return this.catalogQuery
      .findStoreCakes(storeId, after, parseInt(limit))
      .then((page) => this.catalogPresenter.cakePage(page, user.firebaseUid));
  }
}
