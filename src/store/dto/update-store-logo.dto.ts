import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ImageDto } from 'src/common/image/api/image.dto';
import { ImageValue } from 'src/common/image/application/image.value';

export class UpdateStoreLogoDto {
  @ValidateNested()
  @Type(() => ImageDto)
  @IsNotEmpty()
  @ApiProperty({
    type: ImageDto,
    description: '케이크 매장 로고 사진',
    required: false,
  })
  readonly logo: ImageDto;

  constructor(data: ImageValue) {
    this.logo = new ImageDto(data);
  }
}
