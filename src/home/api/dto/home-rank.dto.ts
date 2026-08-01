import { ApiProperty } from '@nestjs/swagger';

class HomeRankItemDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty()
  readonly count: number;

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.count = data?.count;
  }
}

export class HomeRankDto {
  @ApiProperty({ type: [HomeRankItemDto] })
  readonly ranking: HomeRankItemDto[];

  @ApiProperty()
  readonly startDate: string;

  @ApiProperty()
  readonly endDate: string;

  constructor(data: any) {
    this.ranking = (data?.ranking ?? []).map(
      (item) => new HomeRankItemDto(item),
    );
    this.startDate = data?.startDate;
    this.endDate = data?.endDate;
  }
}
