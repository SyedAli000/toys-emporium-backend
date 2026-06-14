import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Product, ProductDocument } from '../schemas/product.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async dashboard() {
    const [totalOrders, totalUsers, totalProducts, revenue] = await Promise.all([
      this.orderModel.countDocuments(),
      this.userModel.countDocuments(),
      this.productModel.countDocuments(),
      this.orderModel.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);
    return {
      totalRevenue: revenue[0]?.total ?? 0,
      totalOrders,
      totalUsers,
      totalProducts,
      revenueChange: '+0%',
      ordersChange: '+0%',
      usersChange: '+0%',
      productsChange: '+0%',
    };
  }

  async sales(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const data = await this.orderModel.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return { days, data };
  }

  async products() {
    const lowStock = await this.productModel
      .find({ stock: { $lte: 5 } })
      .limit(10)
      .lean();
    const top = await this.orderModel.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          sold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 10 },
    ]);
    return { lowStock, topSellers: top };
  }

  async customers() {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const newSignups = await this.userModel.countDocuments({
      createdAt: { $gte: since },
      role: 'customer',
    });
    const active = await this.userModel.countDocuments({
      role: 'customer',
      isActive: true,
    });
    return { newSignups, activeCustomers: active };
  }
}
