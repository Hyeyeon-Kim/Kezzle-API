import { ApiProperty } from '@nestjs/swagger';
import { CakeSimpleResponseDto } from './cake-simple-response.dto';

export class CakeSimpleListResponseDto {
  @ApiProperty({
    type: Boolean,
    description: '데이터가 더 있는가',
    example: true,
  })
  readonly hasMore: boolean;

  @ApiProperty({
    description: '케이크들',
    type: [CakeSimpleResponseDto],
  })
  readonly cakes: CakeSimpleResponseDto[];

  constructor(data: any, more: boolean) {
    this.hasMore = more;
    this.cakes = data;
  }
}
