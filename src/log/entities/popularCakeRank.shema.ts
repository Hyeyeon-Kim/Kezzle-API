import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type PopularCakeRankDocument = PopularCakeRank & Document;

// 홈 Popular 섹션용 사전 계산 read model.
// cakelikelogs 실시간 집계 결과(상위 N건)를 갱신 시점에 통째로 적재한다.
@Schema({ collection: 'popularcakeranks', timestamps: true })
export class PopularCakeRank {
  @Prop({ type: Number, index: true })
  rank: number;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Cake' })
  cakeId: mongoose.Types.ObjectId;

  @Prop({ type: Number, index: true })
  total: number;

  @Prop({ type: Object })
  image: Record<string, unknown>;

  @Prop({ type: String })
  owner_store_id: string;

  @Prop({ type: [String], default: [] })
  tag_ins: string[];

  // 이 배치가 집계한 rolling window 구간. 응답 startDate/endDate 로 노출한다.
  // 이전 버전 배치에는 없을 수 있어 optional 로 둔다.
  @Prop({ type: Date })
  windowStart?: Date;

  @Prop({ type: Date })
  windowEnd?: Date;

  // 같은 갱신 배치는 동일 computedAt 을 공유한다. SWR staleness 판단과 배치 식별에 사용한다.
  @Prop({ type: Date, index: true })
  computedAt: Date;
}

export const PopularCakeRankSchema =
  SchemaFactory.createForClass(PopularCakeRank);
