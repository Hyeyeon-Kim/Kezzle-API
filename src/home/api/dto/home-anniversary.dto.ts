import { ApiProperty } from '@nestjs/swagger';

export class HomeAnniversaryDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty()
  readonly name: string;

  @ApiProperty()
  readonly dday: string;

  @ApiProperty()
  readonly ment: string;

  @ApiProperty({ type: [String] })
  readonly images: string[];

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.name = data?.name;
    this.dday = data?.dday;
    this.ment = data?.mention ?? data?.ment;
    this.images = [...(data?.images ?? [])];
  }
}
