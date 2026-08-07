import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ImageValue } from 'src/shared/image/application/image.value';

export class ImageDto {
  @IsString()
  @ApiProperty({
    description: '파일 업로드할 때 파일명',
    example: '1.png',
  })
  readonly name: string;

  @IsString()
  @ApiProperty({
    description: '파일 업로드 후 바뀐 파일명',
    example: '41f1904d-cb2e-45f3-b5ee-072bc49cba11.png',
  })
  readonly converte_name: string;

  @IsString()
  @ApiProperty({
    description: 'Object key',
    example: 'test/41f1904d-cb2e-45f3-b5ee-072bc49cba11.png',
  })
  readonly key: string;

  @IsString()
  @ApiProperty({
    description: 'S3에 저장된 파일 URL',
    example:
      'https://example-bucket.s3.region.amazonaws.com/test/41f1904d-cb2e-45f3-b5ee-072bc49cba11.png',
  })
  readonly s3Url: string;

  constructor(image?: ImageValue) {
    this.name = image?.name;
    this.converte_name = image?.converteName;
    this.key = image?.key;
    this.s3Url = image?.s3Url;
  }

  static toValue(image: ImageDto): ImageValue {
    return {
      name: image.name,
      converteName: image.converte_name,
      key: image.key,
      s3Url: image.s3Url,
    };
  }
}
