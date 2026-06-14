import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from '../schemas/review.schema';
import { Product, ProductDocument } from '../schemas/product.schema';
import { Order, OrderDocument } from '../schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private async assertCanReview(userId: string, productId: string) {
    const hasDeliveredOrder = await this.orderModel.exists({
      userId: new Types.ObjectId(userId),
      status: 'delivered',
      'items.productId': new Types.ObjectId(productId),
    });
    if (!hasDeliveredOrder) {
      throw new ForbiddenException(
        'You can only review products from delivered orders',
      );
    }
  }

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

  async canReview(userId: string, productId: string) {
    const hasDeliveredOrder = await this.orderModel.exists({
      userId: new Types.ObjectId(userId),
      status: 'delivered',
      'items.productId': new Types.ObjectId(productId),
    });
    if (!hasDeliveredOrder) {
      return { eligible: false, hasReview: false };
    }
    const existing = await this.reviewModel.exists({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
    });
    return { eligible: true, hasReview: !!existing };
  }

  findMyReview(userId: string, productId: string) {
    return this.reviewModel
      .findOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      })
      .lean();
  }

  async create(
    userId: string,
    data: { productId: string; rating: number; comment: string },
  ) {
    await this.assertCanReview(userId, data.productId);
    try {
      const review = await this.reviewModel.create({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(data.productId),
        rating: data.rating,
        comment: data.comment,
      });
      await this.updateProductStats(data.productId);

      void this.notifyManagersNewReview(review, data.productId, userId).catch(
        (err) => console.error('[Review notification]', (err as Error).message),
      );

      return review;
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException('You already reviewed this product');
      }
      throw e;
    }
  }

  private async notifyManagersNewReview(
    review: ReviewDocument,
    productId: string,
    userId: string,
  ) {
    const [product, user] = await Promise.all([
      this.productModel.findById(productId).select('name').lean(),
      this.userModel.findById(userId).select('name').lean(),
    ]);
    await this.notificationsService.createForNewReview({
      reviewId: review._id,
      productId,
      productName: product?.name ?? 'Product',
      customerName: user?.name ?? 'Customer',
      rating: review.rating,
      comment: review.comment,
    });
  }

  findAllAdmin(query: Record<string, string>) {
    const filter: Record<string, unknown> = {};
    if (query.rating) {
      filter.rating = Number(query.rating);
    }

    return this.reviewModel
      .find(filter)
      .populate('userId', 'name email avatar')
      .populate('productId', 'name images')
      .sort({ createdAt: -1 })
      .lean();
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
