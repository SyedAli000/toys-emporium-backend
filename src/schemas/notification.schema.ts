import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ enum: ['ORDER', 'SYSTEM', 'REVIEW'], default: 'ORDER' })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  relatedOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  relatedProductId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Review' })
  relatedReviewId?: Types.ObjectId;

  @Prop({ default: 'manager' })
  targetRole: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  targetUserId?: Types.ObjectId;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
