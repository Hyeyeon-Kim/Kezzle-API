import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KeywordLogDocument = HydratedDocument<KeywordLog>;

@Schema({ timestamps: true, collection: 'keywordlogs' })
export class KeywordLog {
  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop({ type: String })
  searchWord: string;

  @Prop({ type: [{ type: String }] })
  relatedWord: string[];

  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export const KeywordLogSchema = SchemaFactory.createForClass(KeywordLog);
