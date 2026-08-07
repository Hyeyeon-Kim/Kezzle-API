import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  CurationCakeSnapshot,
  CurationCakeSnapshotSchema,
} from './curation-cake-snapshot.schema';
export type CurationDocument = Curation & Document;

@Schema({ timestamps: true }) // timestamps: createdAt과 updatedAt을 자동으로 생성
export class Curation {
  @Prop({ type: [CurationCakeSnapshotSchema], required: true })
  cakes: CurationCakeSnapshot[];

  @Prop({ type: String })
  key: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String })
  note: string;

  @Prop({ type: Date })
  updatedAt?: Date;

  // 갱신 job 의 중복 실행 방지용 claim. 응답 DTO 에는 노출하지 않는다.
  @Prop({ type: Date })
  refreshClaimedAt?: Date;
}

const schema = SchemaFactory.createForClass(Curation);
export const CurationSchema = schema;
