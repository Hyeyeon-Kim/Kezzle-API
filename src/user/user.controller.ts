import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { RolesAllowed } from 'src/auth/decorators/roles.decorator';
import { Roles } from './entities/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/response-user.dto';
import { GetUser } from './decorators/get-user.decorator';
import { AuthenticatedUser } from './application/authenticated-user';
import { CreateUserResponseDto } from './dto/response-create-user.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { assertSelfOrAdmin } from 'src/auth/authorization/self-or-admin';
import { UserPresenter } from './user.presenter';

const userIdParams = {
  name: 'id',
  description: '케이크 ID(ObjectId)',
  required: true,
  type: String,
};

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @RolesAllowed(Roles.ADMIN)
  @Get()
  @ApiOperation({
    summary: '유저 전체 목록 요청',
    description:
      '유저 목록을 요청합니다.' + '\n\n' + 'Admin 권한이 필요합니다.',
  })
  @ApiNoContentResponse({ description: '정보 없음.' })
  async getAll(): Promise<UserResponseDto[]> {
    return UserPresenter.list(await this.userService.findAll());
  }

  @Post()
  @Public()
  @ApiOperation({
    summary: '유저 생성',
    description: '유저를 생성합니다.' + '\n\n' + '권한이 필요없습니다.',
  })
  @ApiCreatedResponse({
    description: '유저 생성 성공',
  })
  @ApiBadRequestResponse({
    description: 'request body의 조건이 잘못됨.',
  })
  async create(
    @Headers('authorization') authorization: string,
    @Body() createUserDto: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    return UserPresenter.created(
      await this.userService.create({
        token: authorization,
        nickname: createUserDto.nickname,
      }),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: '유저 정보 요청',
    description:
      'ID를 이용하여 유저 정보를 요청합니다.' +
      '\n\n' +
      '권한이 필요하지 않습니다.',
  })
  @ApiParam(userIdParams)
  @ApiOkResponse({
    description: '유저 정보 요청 성공',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: '유저를 찾을 수 없습니다.' })
  getOne(
    @Param('id') userId: string,
    @GetUser() userDto: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    assertSelfOrAdmin(userDto, userId);
    return this.userService
      .findOneByFirebase(userId)
      .then((user) => UserPresenter.detail(user));
  }

  @Patch(':id')
  @ApiOperation({
    summary: '유저 정보 수정',
    description:
      'ID를 이용하여 유저 정보를 수정합니다.' +
      '\n\n' +
      '권한이 필요하지 않습니다.',
  })
  @ApiParam(userIdParams)
  @ApiOkResponse({
    description: '유저 정보 수정 성공',
    type: UpdateUserDto,
  })
  @ApiNotFoundResponse({ description: '유저를 찾을 수 없습니다.' })
  modify(
    @Param('id') userId: string,
    @Body() updateData: UpdateUserDto,
    @GetUser() userDto: AuthenticatedUser,
  ) {
    assertSelfOrAdmin(userDto, userId);
    return this.userService.changeContent(userId, {
      nickname: updateData.nickname,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: '유저 정보 삭제',
    description:
      'ID를 이용하여 유저 정보를 삭제합니다.' +
      '\n\n' +
      '권한이 필요하지 않습니다.',
  })
  @ApiParam(userIdParams)
  @ApiOkResponse({
    description: '유저 정보 삭제 성공',
  })
  @ApiNotFoundResponse({ description: '유저를 찾을 수 없습니다.' })
  delete(@Param('id') userId: string, @GetUser() userDto: AuthenticatedUser) {
    assertSelfOrAdmin(userDto, userId);
    return this.userService.removeContent(userId);
  }
}
