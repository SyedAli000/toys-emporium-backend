import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from '../schemas/review.schema';
import { Product, ProductDocument } from '../schemas/product.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  private async updateProductStats(productId: string) {
    const stats = await this.reviewModel.aggregate([
      { $match: { productId: new Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$productId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);
    const avg = stats[0]?.avgRating ?? 0;
    const count = stats[0]?.count ?? 0;
    await this.productModel.findByIdAndUpdate(productId, {
      ratings: Math.round(avg * 10) / 10,
      reviews: count,
    });
  }

  async create(
    userId: string,
    data: { productId: string; rating: number; comment: string },
  ) {
    try {
      const review = await this.reviewModel.create({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(data.productId),
        rating: data.rating,
        comment: data.comment,
      });
      await this.updateProductStats(data.productId);
      return review;
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException('You already reviewed this product');
      }
      throw e;
    }
  }

  findByProduct(productId: string) {
    return this.reviewModel
      .find({ productId: new Types.ObjectId(productId) })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();
  }

  async update(id: string, userId: string, data: Partial<Review>) {
    const review = await this.reviewModel.findById(id);
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId.toString() !== userId) {
      throw new NotFoundException('Review not found');
    }
    Object.assign(review, data);
    await review.save();
    await this.updateProductStats(review.productId.toString());
    return review;
  }

  async remove(id: string, userId: string, role: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) throw new NotFoundException('Review not found');
    if (
      review.userId.toString() !== userId &&
      !['admin', 'super_admin'].includes(role)
    ) {
      throw new NotFoundException('Review not found');
    }
    const productId = review.productId.toString();
    await review.deleteOne();
    await this.updateProductStats(productId);
    return { message: 'Review deleted' };
  }
}
