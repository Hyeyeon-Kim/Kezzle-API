import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  CakeImageEmbedded,
  CakeImageEmbeddedSchema,
} from './cake-image.schema';

export type CakeDocument = CakePersistenceModel & Document;
export const CAKE_MODEL_NAME = 'Cake';

@Schema({ timestamps: true, collection: 'cakes' })
export class CakePersistenceModel {
  @Prop({ type: CakeImageEmbeddedSchema, required: true })
  image: CakeImageEmbedded;

  @Prop({ type: String })
  cursor: string;

  @Prop({ type: [{ type: String, ref: 'User', default: [] }] })
  user_like_ids: string[];

  @Prop({ type: String, ref: 'User', index: true })
  owner_store_id: string;

  @Prop({ type: String })
  like_ins: string;

  @Prop({ type: [{ type: String }] })
  tag_ins: string[];

  @Prop({ type: String })
  content_ins: string;

  @Prop({ type: Number })
  cal_likes: number;

  @Prop({ type: Number, unique: true, index: true })
  faiss_id: number;

  @Prop({ type: Boolean, index: true, default: false })
  is_delete: boolean;
}

const schema = SchemaFactory.createForClass(CakePersistenceModel);
export const CakeSchema = schema;
