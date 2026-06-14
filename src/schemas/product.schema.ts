import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, strict: false, collection: 'products' })
export class Product {
  @Prop({ trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0, min: 0 })
  price: number;

  @Prop({ min: 0 })
  cost?: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category?: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  stock: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: 0, min: 0, max: 5 })
  ratings: number;

  @Prop({ default: 0, min: 0 })
  reviews: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFlashSale: boolean;

  @Prop({ default: 0, min: 0, max: 100 })
  discountPercentage: number;

  @Prop({ default: false })
  hasReturn: boolean;

  @Prop({ default: false })
  hasWarranty: boolean;

  @Prop({ default: '14 days easy return' })
  returnPolicy: string;

  @Prop({ default: '1 Year Warranty' })
  warrantyText: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
