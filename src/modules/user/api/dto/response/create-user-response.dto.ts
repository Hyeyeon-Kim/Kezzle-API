import { ApiProperty } from '@nestjs/swagger';
import { UserView } from 'src/modules/user/application/user.view';
import { Roles } from 'src/platform/auth/roles.enum';

export class CreateUserResponseDto {
  @ApiProperty({ description: '생성된 유저 ID(ObjectId)' })
  readonly _id?: string;

  @ApiProperty()
  readonly firebaseUid: string;

  @ApiProperty()
  readonly nickname: string;

  @ApiProperty()
  readonly oauth_provider: string;

  @ApiProperty({ enum: Roles, isArray: true })
  readonly roles: Roles[];

  @ApiProperty({ type: [String] })
  readonly cake_like_ids: string[];

  @ApiProperty({ type: [String] })
  readonly store_like_ids: string[];

  @ApiProperty({ type: String, format: 'date-time', required: false })
  readonly createdAt?: Date;

  @ApiProperty({ type: String, format: 'date-time', required: false })
  readonly updatedAt?: Date;

  constructor(user: UserView) {
    this._id = user.id;
    this.firebaseUid = user.firebaseUid;
    this.nickname = user.nickname;
    this.oauth_provider = user.oauthProvider;
    this.roles = [...user.roles];
    this.cake_like_ids = [...user.cakeLikeIds];
    this.store_like_ids = [...user.storeLikeIds];
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
