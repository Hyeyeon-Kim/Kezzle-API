import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/common/image/api/image.dto';

export class CakeCreateResponseDto {
  @ApiProperty({
    description: '케이크 ID(ObjectId)',
    example: '60b4d1b3e6b0b3001b9b9b9b',
  })
  readonly _id: string;

  @ApiProperty({ type: ImageDto, description: 'ImageDto' })
  readonly image: ImageDto;

  @ApiProperty({ type: String, description: '케이크 소유 매장 ID(ObjectId)' })
  readonly owner_store_id: string;

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.image = data?.image ? new ImageDto(data.image) : data?.image;
    this.owner_store_id = data?.ownerStoreId ?? data?.owner_store_id;
  }
}
