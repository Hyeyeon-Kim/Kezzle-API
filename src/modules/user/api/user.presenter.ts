import { UserView } from 'src/modules/user/application/user.view';
import { CreateUserResponseDto } from './dto/response/create-user-response.dto';
import { UserResponseDto } from './dto/response/user-response.dto';

export class UserPresenter {
  static created(user: UserView): CreateUserResponseDto {
    return new CreateUserResponseDto(user);
  }

  static detail(user: UserView): UserResponseDto {
    return new UserResponseDto(user);
  }

  static list(users: UserView[]): UserResponseDto[] {
    return users.map((user) => this.detail(user));
  }
}
