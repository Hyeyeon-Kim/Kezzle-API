import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ImageDto } from 'src/common/image/api/image.dto';
import { ImageValue } from 'src/common/image/application/image.value';

export class UpdateCakeDto {
  @ValidateNested()
  @Type(() => ImageDto)
  @IsNotEmpty()
  @ApiProperty({
    type: ImageDto,
    description: '케이크에 관련된 이미지',
    example: {
      name: '1.png',
      s3Url:
        'https://example-bucket.s3.region.amazonaws.com/test/41f1904d-cb2e-45f3-b5ee-072bc49cba11.png',
    },
    required: false,
  })
  readonly image: ImageDto;

  constructor(data: ImageValue) {
    this.image = new ImageDto(data);
  }
}
