import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type CakeLikeLogDocument = HydratedDocument<CakeLikeLog>;

@Schema({ timestamps: true, collection: 'cakelikelogs' })
export class CakeLikeLog {
  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Cake', required: true })
  cakeId: mongoose.Types.ObjectId;

  @Prop({ type: Boolean })
  type: boolean;

  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export const CakeLikeLogSchema = SchemaFactory.createForClass(CakeLikeLog);
