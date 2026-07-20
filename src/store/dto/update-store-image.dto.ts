import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ImageDto } from 'src/common/image/api/image.dto';
import { ImageValue } from 'src/common/image/application/image.value';
import { ImagePersistenceRecord } from 'src/common/image/image.mapper';

export class UpdateStoreImageDto {
  @ValidateNested()
  @Type(() => ImageDto)
  @IsNotEmpty()
  @ApiProperty({
    type: [ImageDto],
    description: '케이크 매장 소개 이미지들',
    required: false,
  })
  readonly detail_images: ImageDto[];

  constructor(data: ImageValue, oldData: ImagePersistenceRecord[]) {
    this.detail_images = [
      ...oldData.map((image) => ImageDto.fromPersistence(image)),
      new ImageDto(data),
    ];
  }
}
