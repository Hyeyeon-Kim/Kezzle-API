import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CakeService } from './cake.service';
import { Roles } from 'src/user/entities/roles.enum';
import { RolesAllowed } from 'src/auth/decorators/roles.decorator';
import { GetUser } from 'src/user/decorators/get-user.decorator';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { CakeResponseDto } from './dto/response-cake.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { CakesSimpleResponseDto } from './dto/response-cakes-simple.dto';
import { CakePresenter } from './cake.presenter';

const cakeIdParams = {
  name: 'id',
  description: '케이크 ID(ObjectId)',
  required: true,
  type: String,
};

@ApiTags('cakes')
@Controller()
@ApiBearerAuth()
export class CakeController {
  constructor(private readonly cakeService: CakeService) {}

  @ApiQuery({
    name: 'after',
    description:
      'Cursor를 기준으로 커서 기반 페이지네이션을 합니다.(없으면 첫번째 페이지)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'count',
    description: '요청할 케이크 개수',
    required: false,
    type: Number,
  })
  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes/newest')
  async getAllByNewest(
    @Query('after') after,
    @Query('count') limit,
  ): Promise<CakesSimpleResponseDto> {
    return CakePresenter.simpleList(
      await this.cakeService.findAllByNewest(after, parseInt(limit)),
    );
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes/anniversary/:id')
  async cakeAnniversary(
    @Param('id') anni: string,
    @GetUser() userDto: AuthenticatedUser,
    @Query('page') page: string,
  ) {
    return CakePresenter.anniversary(
      await this.cakeService.anniversary(anni, parseInt(page)),
      userDto.firebaseUid,
    );
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get('cakes/:id')
  @ApiOperation({
    summary: '케이크 정보 요청',
    description:
      'ID를 이용하여 케이크 정보를 요청합니다.' +
      '\n\n' +
      '권한이 필요하지 않습니다.',
  })
  @ApiParam(cakeIdParams)
  @ApiOkResponse({
    description: '케이크 정보 요청 성공',
    type: CakeResponseDto,
  })
  @ApiNotFoundResponse({ description: '케이크를 찾을 수 없습니다.' })
  async getOne(
    @Param('id') cakeId: string,
    @GetUser() userDto: AuthenticatedUser,
  ): Promise<CakeResponseDto> {
    return CakePresenter.detail(
      await this.cakeService.findOne(cakeId),
      userDto.firebaseUid,
    );
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER)
  @Patch('cakes/:id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '케이크 정보 수정',
    description:
      'ID를 이용하여 케이크 정보를 수정합니다.' +
      '\n\n' +
      'Admin 또는 Seller 권한이 필요합니다.',
  })
  @ApiParam(cakeIdParams)
  @ApiOkResponse({
    description: '케이크 정보 수정 성공',
    type: CakeResponseDto,
  })
  @ApiNotFoundResponse({ description: '케이크를 찾을 수 없습니다.' })
  modify(
    @Param('id') cakeId: string,
    @UploadedFile() file,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    return this.cakeService.changeContent(cakeId, userDto, file);
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER)
  @Delete('cakes/:id')
  @ApiOperation({
    summary: '케이크 정보 삭제',
    description:
      'ID를 이용하여 케이크 정보를 삭제합니다.' +
      '\n\n' +
      'Admin 권한이 필요합니다.',
  })
  @ApiParam(cakeIdParams)
  @ApiOkResponse({
    description: '케이크 정보 삭제 성공',
  })
  @ApiNotFoundResponse({ description: '케이크를 찾을 수 없습니다.' })
  delete(@Param('id') cakeId: string, @GetUser() userDto: AuthenticatedUser) {
    return this.cakeService.removeContent(cakeId, userDto);
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER)
  @Post('stores/:id/cakes')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 3000 },
      { name: 'excel', maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: '특정 매장의 케이크 생성',
    description:
      '케이크를 생성합니다.' + '\n\n' + 'Admin 또는 Seller 권한이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '매장 ID' })
  @ApiCreatedResponse({
    description: '케이크 생성 성공',
  })
  @ApiBadRequestResponse({
    description: 'request body의 조건이 잘못됨.',
  })
  createCake(
    @Param('id') storeId: string,
    @GetUser() userDto: AuthenticatedUser,
    @UploadedFiles() files,
  ) {
    return this.cakeService.createCake(storeId, userDto, files);
  }
}
