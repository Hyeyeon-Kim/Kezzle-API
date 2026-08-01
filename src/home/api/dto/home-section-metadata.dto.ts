import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HomeSectionMetadataView,
  HomeSectionsView,
} from '../../application/home.view';

export class HomeSectionMetadataDto {
  @ApiProperty({ enum: ['success', 'fallback'], example: 'success' })
  readonly status: HomeSectionMetadataView['status'];

  @ApiPropertyOptional({
    enum: ['timeout', 'dependency_error'],
    example: 'timeout',
  })
  readonly reason?: HomeSectionMetadataView['reason'];

  @ApiProperty({ description: '섹션 처리 시간(ms)', example: 12.34 })
  readonly durationMs: number;

  constructor(result: HomeSectionMetadataView) {
    this.status = result.status;
    this.durationMs = result.durationMs;
    if (result.status === 'fallback') {
      this.reason = result.reason;
    }
  }
}

export class HomeSectionsMetadataDto {
  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly recommendCakes: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly anniversary: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly popularCakes: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly keywordRanks: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly newestCakes: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly curations: HomeSectionMetadataDto;

  constructor(results: HomeSectionsView) {
    this.recommendCakes = new HomeSectionMetadataDto(results.recommendCakes);
    this.anniversary = new HomeSectionMetadataDto(results.anniversary);
    this.popularCakes = new HomeSectionMetadataDto(results.popularCakes);
    this.keywordRanks = new HomeSectionMetadataDto(results.keywordRanks);
    this.newestCakes = new HomeSectionMetadataDto(results.newestCakes);
    this.curations = new HomeSectionMetadataDto(results.curations);
  }
}
