import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Product, ProductDocument } from '../schemas/product.schema';

/** Revenue counts ONLY after manager presses Ship. */
const REVENUE_STATUSES = ['shipped', 'delivered'];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  private getMonthRange(month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { start, end, month: m, year: y, monthLabel: label };
  }

  /** Only shipped/delivered orders with a ship date in the selected month. */
  private revenueMatchForMonth(start: Date, end: Date) {
    return {
      status: { $in: REVENUE_STATUSES },
      shippedAt: { $exists: true, $gte: start, $lt: end },
    };
  }

  async dashboard(month?: number, year?: number) {
    const { start, end, monthLabel, month: m, year: y } = this.getMonthRange(
      month,
      year,
    );

    const revenueMatch = this.revenueMatchForMonth(start, end);

    const [totalProducts, monthStats, allTimeOrders, pendingOrders] =
      await Promise.all([
        this.productModel.countDocuments(),
        this.orderModel.aggregate([
          { $match: revenueMatch },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalAmount' },
              shippedOrders: { $sum: 1 },
            },
          },
        ]),
        this.orderModel.countDocuments(),
        this.orderModel.countDocuments({
          status: { $in: ['pending', 'confirmed'] },
        }),
      ]);

    const stats = monthStats[0] ?? { totalRevenue: 0, shippedOrders: 0 };

    return {
      totalRevenue: stats.totalRevenue ?? 0,
      shippedOrders: stats.shippedOrders ?? 0,
      confirmedOrders: stats.shippedOrders ?? 0,
      totalOrders: allTimeOrders,
      pendingOrders,
      totalProducts,
      month: m,
      year: y,
      monthLabel,
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
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          shippedAt: { $exists: true, $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$shippedAt' },
          },
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
