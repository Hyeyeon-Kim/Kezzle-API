import { BadRequestException } from '@nestjs/common';
import { CreateUserDto } from 'src/user/api/dto/request/create-user.dto';
import { createValidationPipe } from './app.validation';

describe('application validation pipe', () => {
  it('rejects unknown fields instead of passing them to a DTO', async () => {
    await expect(
      createValidationPipe().transform(
        { nickname: 'user', roles: ['ADMIN'] },
        { type: 'body', metatype: CreateUserDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforms a valid body into its DTO type', async () => {
    const result = await createValidationPipe().transform(
      { nickname: 'user' },
      { type: 'body', metatype: CreateUserDto },
    );

    expect(result).toBeInstanceOf(CreateUserDto);
  });
});
