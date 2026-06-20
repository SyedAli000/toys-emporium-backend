import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { CartService } from '../cart/cart.service';
import { Product, ProductDocument } from '../schemas/product.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import {
  notifyAdminNewOrder,
  notifyCustomerOrderPlaced,
  notifyCustomerStatusChange,
} from './order-mail.helper';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private cartService: CartService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  private getOrderUserId(userId: unknown): string {
    if (typeof userId === 'object' && userId !== null && '_id' in userId) {
      return String((userId as { _id: Types.ObjectId })._id);
    }
    return String(userId);
  }

  private formatOrder(order: OrderDocument, keepPopulatedUser = false) {
    const o = order.toObject ? order.toObject() : order;
    const populatedUser =
      typeof o.userId === 'object' &&
      o.userId !== null &&
      '_id' in o.userId;

    return {
      ...o,
      _id: o._id.toString(),
      userId: o.userId
        ? keepPopulatedUser && populatedUser
          ? {
              ...o.userId,
              _id: (o.userId as { _id: Types.ObjectId })._id.toString(),
            }
          : this.getOrderUserId(o.userId)
        : null,
    };
  }

  private async buildOrderItems(
    rawItems: { productId: string; quantity: number }[],
  ) {
    const items: { productId: Types.ObjectId; quantity: number; price: number }[] =
      [];
    let totalAmount = 0;

    for (const item of rawItems) {
      const product = await this.productModel.findById(item.productId);
      if (!product) continue;
      const stock = product.stock ?? 0;
      if (stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name || 'product'}`,
        );
      }
      product.stock = stock - item.quantity;
      await product.save();
      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;
      items.push({
        productId: new Types.ObjectId(item.productId),
        quantity: item.quantity,
        price: product.price,
      });
    }

    if (!items.length) {
      throw new BadRequestException('No valid items in order');
    }

    return { items, totalAmount };
  }

  async create(
    userId: string,
    body: {
      shippingAddress: Order['shippingAddress'];
      notes?: string;
      paymentMethod?: string;
    },
  ) {
    const cart = await this.cartService.getCart(userId);
    if (!cart.items?.length) {
      throw new BadRequestException('Cart is empty');
    }

    const { items, totalAmount } = await this.buildOrderItems(
      cart.items.map((item) => ({
        productId: item.productId.toString(),
        quantity: item.quantity,
      })),
    );

    const order = await this.orderModel.create({
      userId: new Types.ObjectId(userId),
      isGuest: false,
      items,
      shippingAddress: body.shippingAddress,
      totalAmount,
      status: 'pending',
      paymentMethod: body.paymentMethod || 'cod',
      notes: body.notes,
    });

    await this.notificationsService.createForNewOrder({
      _id: order._id,
      shippingAddress: body.shippingAddress,
      totalAmount,
    });

    await this.cartService.clearCart(userId);

    void notifyCustomerOrderPlaced(
      order,
      this.productModel,
      this.mailService,
      this.config,
    ).catch((err) => {
      console.error('[Order email]', (err as Error).message);
    });

    void notifyAdminNewOrder(
      order,
      this.productModel,
      this.mailService,
      this.config,
    ).catch((err) => {
      console.error('[Admin order email]', (err as Error).message);
    });

    return this.formatOrder(order);
  }

  async createGuest(body: {
    items: { productId: string; quantity: number }[];
    shippingAddress: Order['shippingAddress'];
    notes?: string;
    paymentMethod?: string;
  }) {
    if (!body.items?.length) {
      throw new BadRequestException('Order must include at least one item');
    }

    const { items, totalAmount } = await this.buildOrderItems(body.items);

    const order = await this.orderModel.create({
      isGuest: true,
      items,
      shippingAddress: body.shippingAddress,
      totalAmount,
      status: 'pending',
      paymentMethod: body.paymentMethod || 'cod',
      notes: body.notes,
    });

    await this.notificationsService.createForNewOrder({
      _id: order._id,
      shippingAddress: body.shippingAddress,
      totalAmount,
    });

    void notifyCustomerOrderPlaced(
      order,
      this.productModel,
      this.mailService,
      this.config,
    ).catch((err) => {
      console.error('[Guest order email]', (err as Error).message);
    });

    void notifyAdminNewOrder(
      order,
      this.productModel,
      this.mailService,
      this.config,
    ).catch((err) => {
      console.error('[Guest admin order email]', (err as Error).message);
    });

    return this.formatOrder(order);
  }

  async findByUser(userId: string) {
    const orders = await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return orders.map((o) => ({
      ...o,
      _id: o._id.toString(),
      userId: o.userId?.toString() ?? null,
    }));
  }

  async findOne(id: string, user: { userId: string; role: string }) {
    const order = await this.orderModel.findById(id).populate('userId', 'name email');
    if (!order) throw new NotFoundException('Order not found');
    const isOwner = this.getOrderUserId(order.userId) === user.userId;
    const isStaff = ['manager', 'admin', 'super_admin'].includes(user.role);
    if (!isOwner && !isStaff) {
      throw new ForbiddenException();
    }
    return this.formatOrder(order, isStaff);
  }

  async updateStatus(
    id: string,
    data: { status?: string; trackingNumber?: string },
  ) {
    const existing = await this.orderModel.findById(id);
    if (!existing) throw new NotFoundException('Order not found');
    const previousStatus = existing.status;

    const updatePayload: Record<string, unknown> = { ...data };
    if (data.status === 'confirmed' && previousStatus !== 'confirmed') {
      updatePayload.confirmedAt = new Date();
    }
    if (data.status === 'shipped' && previousStatus !== 'shipped') {
      updatePayload.shippedAt = new Date();
    }

    const order = await this.orderModel.findByIdAndUpdate(id, updatePayload, {
      new: true,
    });
    if (!order) throw new NotFoundException('Order not found');

    void notifyCustomerStatusChange(
      order,
      previousStatus,
      this.mailService,
      this.productModel,
      this.config,
    ).catch((err) => {
      console.error('[Order status email]', (err as Error).message);
    });

    if (order.status !== previousStatus) {
      void this.notificationsService
        .createForOrderStatusUpdate({
          _id: order._id,
          userId: order.userId,
          status: order.status,
          trackingNumber: order.trackingNumber,
        })
        .catch((err) => {
          console.error('[Order status notification]', (err as Error).message);
        });
    }

    return this.formatOrder(order);
  }

  async findAllAdmin(query: Record<string, string>) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.search && Types.ObjectId.isValid(query.search)) {
      filter._id = new Types.ObjectId(query.search);
    }
    const orders = await this.orderModel
      .find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return orders.map((o) => ({
      ...o,
      _id: o._id.toString(),
      userId: o.userId,
    }));
  }
}
