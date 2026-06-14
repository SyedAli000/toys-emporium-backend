import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BannerDocument = Banner & Document;

@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  image: string;

  @Prop()
  link?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  position: number;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
