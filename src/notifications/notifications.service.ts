import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async createForNewOrder(order: {
    _id: Types.ObjectId | string;
    shippingAddress: { fullName: string; phone: string };
    totalAmount: number;
  }) {
    const shortId = order._id.toString().slice(-8);
    return this.notificationModel.create({
      type: 'ORDER',
      title: `New order #${shortId}`,
      message: `${order.shippingAddress.fullName} (${order.shippingAddress.phone}) placed an order for $${order.totalAmount.toFixed(2)}`,
      relatedOrderId: new Types.ObjectId(order._id.toString()),
      targetRole: 'manager',
      isRead: false,
    });
  }

  findForManager(limit = 20) {
    return this.notificationModel
      .find({ targetRole: 'manager' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async countUnread() {
    return this.notificationModel.countDocuments({
      targetRole: 'manager',
      isRead: false,
    });
  }

  async markRead(id: string) {
    const n = await this.notificationModel.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true },
    );
    if (!n) throw new NotFoundException('Notification not found');
    return n;
  }

  async markAllRead() {
    await this.notificationModel.updateMany(
      { targetRole: 'manager', isRead: false },
      { isRead: true },
    );
    return { message: 'All notifications marked as read' };
  }
}
