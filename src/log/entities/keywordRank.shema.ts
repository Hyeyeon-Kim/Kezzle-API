import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type KeywordRankDocument = KeywordRank & Document;

// 홈 keywordRanks 섹션용 사전 계산 read model.
// keywordlogs 실시간 집계 결과(상위 N건)를 갱신 시점에 통째로 적재한다.
@Schema({ collection: 'keywordranks', timestamps: true })
export class KeywordRank {
  @Prop({ type: Number, index: true })
  rank: number;

  @Prop({ type: String })
  searchWord: string;

  @Prop({ type: Number })
  count: number;

  // 이 배치가 집계한 rolling window 구간. 응답 startDate/endDate 로 노출한다.
  @Prop({ type: Date })
  windowStart: Date;

  @Prop({ type: Date })
  windowEnd: Date;

  // 같은 갱신 배치는 동일 computedAt 을 공유한다. SWR staleness 판단과 배치 식별에 사용한다.
  @Prop({ type: Date, index: true })
  computedAt: Date;

  // 집계 결과가 없었던 최신 window를 기록하는 배치 마커다.
  @Prop({ type: Boolean, default: false })
  isEmptyBatch?: boolean;
}

export const KeywordRankSchema = SchemaFactory.createForClass(KeywordRank);
