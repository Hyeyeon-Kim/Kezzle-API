import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { StoreService } from 'src/modules/store/application/store.service';
import { CreateStoreDto } from 'src/modules/store/api/dto/request/create-store.dto';
import { UpdateStoreDto } from 'src/modules/store/api/dto/request/update-store.dto';
import { Roles } from 'src/platform/auth/roles.enum';
import { RolesAllowed } from 'src/platform/auth/decorators/roles.decorator';
import { GetUser } from 'src/platform/auth/decorators/get-user.decorator';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { DetailStoreResponseDto } from './dto/response/detail-store-response.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateStoreResponseDto } from './dto/response/create-store-response.dto';
import { StorePresenter } from './store.presenter';
import { MulterMediaFileMapper } from 'src/integrations/media/api/multer-media-file.mapper';
import { StoreMediaService } from 'src/modules/store/application/media/store-media.service';
import { singleImageUploadOptions } from 'src/integrations/media/api/upload-options';

const storeIdParams = {
  name: 'id',
  description: '매장 ID(ObjectId)',
  required: true,
  type: String,
};

@ApiTags('stores')
@Controller('stores')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly storeMediaService: StoreMediaService,
  ) {}

  @RolesAllowed(Roles.ADMIN)
  @Post()
  @ApiOperation({
    summary: '매장 생성',
    description:
      '매장을 생성합니다.' + '\n\n' + 'Admin 또는 Seller 권한이 필요합니다.',
  })
  @ApiCreatedResponse({
    description: '매장 생성 성공',
    type: CreateStoreResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'request body의 조건이 잘못됨.',
  })
  async create(@Body() storeData: CreateStoreDto) {
    return StorePresenter.created(
      await this.storeService.create(StorePresenter.toCreateData(storeData)),
    );
  }

  @RolesAllowed(Roles.ADMIN, Roles.SELLER, Roles.BUYER)
  @Get(':id')
  @ApiOperation({
    summary: '매장 정보 요청',
    description:
      'ID를 이용하여 매장 정보를 요청합니다.' +
      '\n\n' +
      '권한이 필요하지 않습니다.',
  })
  @ApiParam(storeIdParams)
  @ApiOkResponse({
    description: '매장 정보 요청 성공',
    type: DetailStoreResponseDto,
  })
  @ApiNotFoundResponse({ description: '매장을 찾을 수 없습니다.' })
  async getOne(
    @Param('id') cakeId: string,
    @GetUser() userDto: AuthenticatedUser,
  ): Promise<DetailStoreResponseDto> {
    return StorePresenter.detail(
      await this.storeService.findOne(cakeId),
      userDto.firebaseUid,
    );
  }

  @RolesAllowed(Roles.SELLER, Roles.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: '매장 정보 수정',
    description:
      'ID를 이용하여 매장 정보를 수정합니다.' +
      '\n\n' +
      'Admin 또는 Seller 권한이 필요합니다.',
  })
  @ApiParam(storeIdParams)
  @ApiOkResponse({
    description: '매장 정보 수정 성공',
    type: UpdateStoreDto,
  })
  @ApiNotFoundResponse({ description: '매장을 찾을 수 없습니다.' })
  update(
    @Param('id') storeId: string,
    @Body() updateStoreDto: UpdateStoreDto,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    return this.storeService.changeContent(
      storeId,
      StorePresenter.toUpdateData(updateStoreDto),
      userDto,
    );
  }

  @RolesAllowed(Roles.SELLER, Roles.ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: '매장 정보 삭제',
    description:
      'ID를 이용하여 매장 정보를 삭제합니다.' +
      '\n\n' +
      'Admin 또는 Seller 권한이 필요합니다.',
  })
  @ApiParam(storeIdParams)
  @ApiOkResponse({
    description: '매장 정보 삭제 성공',
  })
  @ApiNotFoundResponse({ description: '매장을 찾을 수 없습니다.' })
  remove(@Param('id') storeId: string, @GetUser() userDto: AuthenticatedUser) {
    return this.storeService.removeContent(storeId, userDto);
  }

  @RolesAllowed(Roles.SELLER, Roles.ADMIN)
  @Patch(':id/uploads/logo')
  @UseInterceptors(FileInterceptor('file', singleImageUploadOptions()))
  @ApiOperation({
    summary: '매장 정보 로고 수정',
    description:
      'ID를 이용하여 매장 로고 정보를 수정합니다.' +
      '\n\n' +
      'Admin 또는 Seller 권한이 필요합니다.',
  })
  @ApiParam(storeIdParams)
  @ApiOkResponse({
    description: '매장 로고 정보 수정 성공',
    type: UpdateStoreDto,
  })
  @ApiNotFoundResponse({ description: '매장을 찾을 수 없습니다.' })
  updateLogo(
    @Param('id') storeId: string,
    @GetUser() userDto: AuthenticatedUser,
    @UploadedFile() file,
  ) {
    return this.storeMediaService.replaceLogo(
      storeId,
      userDto,
      MulterMediaFileMapper.toMediaFile(file),
    );
  }

  @RolesAllowed(Roles.SELLER, Roles.ADMIN)
  @Patch(':id/uploads/storeimage')
  @UseInterceptors(FileInterceptor('file', singleImageUploadOptions()))
  uploadImage(
    @Param('id') storeId: string,
    @GetUser() userDto: AuthenticatedUser,
    @UploadedFile() file,
  ) {
    return this.storeMediaService.addDetailImage(
      storeId,
      userDto,
      MulterMediaFileMapper.toMediaFile(file),
    );
  }

  @RolesAllowed(Roles.SELLER, Roles.ADMIN)
  @Delete(':id/deletes/storeimage')
  removeImage(
    @Param('id') storeId: string,
    @GetUser() userDto: AuthenticatedUser,
    @Query('index') fileIdx,
  ) {
    return this.storeMediaService.removeDetailImage(
      storeId,
      userDto,
      parseInt(fileIdx),
    );
  }
}
