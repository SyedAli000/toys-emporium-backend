import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';
import { formatPrice } from '../common/currency';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  private async purgeExpiredRead() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.notificationModel.deleteMany({
      isRead: true,
      $or: [
        { readAt: { $lte: cutoff } },
        { readAt: { $exists: false }, updatedAt: { $lte: cutoff } },
      ],
    });
  }

  async createForNewOrder(order: {
    _id: Types.ObjectId | string;
    shippingAddress: { fullName: string; phone: string };
    totalAmount: number;
  }) {
    const shortId = order._id.toString().slice(-8);
    return this.notificationModel.create({
      type: 'ORDER',
      title: `New order #${shortId}`,
      message: `${order.shippingAddress.fullName} (${order.shippingAddress.phone}) placed an order for ${formatPrice(order.totalAmount)}`,
      relatedOrderId: new Types.ObjectId(order._id.toString()),
      targetRole: 'manager',
      isRead: false,
    });
  }

  async createForNewReview(data: {
    reviewId: Types.ObjectId | string;
    productId: Types.ObjectId | string;
    productName: string;
    customerName: string;
    rating: number;
    comment: string;
  }) {
    const snippet =
      data.comment.length > 80
        ? `${data.comment.slice(0, 80)}…`
        : data.comment;
    return this.notificationModel.create({
      type: 'REVIEW',
      title: 'New product review',
      message: `${data.customerName} rated "${data.productName}" ${data.rating}/5: "${snippet}"`,
      relatedProductId: new Types.ObjectId(data.productId.toString()),
      relatedReviewId: new Types.ObjectId(data.reviewId.toString()),
      targetRole: 'manager',
      isRead: false,
    });
  }

  async createForOrderStatusUpdate(order: {
    _id: Types.ObjectId | string;
    userId?: Types.ObjectId | string | null;
    status: string;
    trackingNumber?: string;
  }) {
    if (!order.userId) return;
    if (!['confirmed', 'shipped'].includes(order.status)) return;

    const shortId = order._id.toString().slice(-8);
    const title =
      order.status === 'confirmed'
        ? `Order #${shortId} confirmed`
        : `Order #${shortId} shipped`;
    const message =
      order.status === 'confirmed'
        ? 'Your order has been confirmed and is being prepared.'
        : order.trackingNumber
          ? `Your order is on its way! Tracking: ${order.trackingNumber}`
          : 'Your order has been shipped and is on its way!';

    return this.notificationModel.create({
      type: 'ORDER',
      title,
      message,
      relatedOrderId: new Types.ObjectId(order._id.toString()),
      targetRole: 'customer',
      targetUserId: new Types.ObjectId(order.userId.toString()),
      isRead: false,
    });
  }

  findForUser(userId: string, limit = 20) {
    return this.notificationModel
      .find({
        targetRole: 'customer',
        targetUserId: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async countUnreadForUser(userId: string) {
    return this.notificationModel.countDocuments({
      targetRole: 'customer',
      targetUserId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markReadForUser(id: string, userId: string) {
    const n = await this.notificationModel.findOneAndUpdate(
      {
        _id: id,
        targetUserId: new Types.ObjectId(userId),
        targetRole: 'customer',
      },
      { isRead: true },
      { new: true },
    );
    if (!n) throw new NotFoundException('Notification not found');
    return n;
  }

  async markAllReadForUser(userId: string) {
    await this.notificationModel.updateMany(
      {
        targetRole: 'customer',
        targetUserId: new Types.ObjectId(userId),
        isRead: false,
      },
      { isRead: true },
    );
    return { message: 'All notifications marked as read' };
  }

  async findForManager(limit = 20) {
    await this.purgeExpiredRead();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.notificationModel
      .find({
        targetRole: 'manager',
        $or: [
          { isRead: false },
          { isRead: true, readAt: { $gte: cutoff } },
          { isRead: true, readAt: { $exists: false }, updatedAt: { $gte: cutoff } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async countUnread() {
    await this.purgeExpiredRead();
    return this.notificationModel.countDocuments({
      targetRole: 'manager',
      isRead: false,
    });
  }

  async markRead(id: string) {
    const n = await this.notificationModel.findByIdAndUpdate(
      id,
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!n) throw new NotFoundException('Notification not found');
    await this.purgeExpiredRead();
    return n;
  }

  async markAllRead() {
    await this.notificationModel.updateMany(
      { targetRole: 'manager', isRead: false },
      { isRead: true, readAt: new Date() },
    );
    await this.purgeExpiredRead();
    return { message: 'All notifications marked as read' };
  }
}
