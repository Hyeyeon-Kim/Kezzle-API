import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

// AI 응답은 model 변경에 따라 key가 추가될 수 있다. 알려진 조회 key는
// casting하되 strict:false로 아직 모르는 legacy/AI key도 그대로 보존한다.
@Schema({ _id: false, strict: false })
export class CurationCakeSnapshot {
  @Prop({ type: String })
  id?: string;

  @Prop({ type: SchemaTypes.Mixed })
  image?: Record<string, unknown>;

  @Prop({ type: String })
  owner_store_id?: string;

  @Prop({ type: String })
  cursor?: string;

  @Prop({ type: [String] })
  tag_ins?: string[];

  @Prop({ type: [String] })
  user_like_ids?: string[];

  @Prop({ type: Number })
  score?: number;
}

export const CurationCakeSnapshotSchema =
  SchemaFactory.createForClass(CurationCakeSnapshot);
