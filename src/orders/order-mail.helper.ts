import { Model } from 'mongoose';
import { ProductDocument } from '../schemas/product.schema';
import { OrderDocument } from '../schemas/order.schema';
import { MailService, OrderEmailPayload, OrderLineForEmail } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

export async function buildOrderEmailPayload(
  order: OrderDocument,
  productModel: Model<ProductDocument>,
  config: ConfigService,
): Promise<OrderEmailPayload | null> {
  const email = order.shippingAddress?.email?.trim();
  if (!email) return null;

  const lines: OrderLineForEmail[] = [];
  for (const item of order.items || []) {
    const product = await productModel.findById(item.productId).lean();
    lines.push({
      name: (product as { name?: string })?.name || 'Product',
      quantity: item.quantity,
      price: item.price,
    });
  }

  const frontendUrl =
    config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

  return {
    orderId: order._id.toString(),
    customerName: order.shippingAddress.fullName || 'Customer',
    customerEmail: email,
    totalAmount: order.totalAmount,
    status: order.status,
    items: lines,
    trackingNumber: order.trackingNumber,
    frontendUrl,
  };
}

export async function notifyCustomerOrderPlaced(
  order: OrderDocument,
  productModel: Model<ProductDocument>,
  mail: MailService,
  config: ConfigService,
) {
  const payload = await buildOrderEmailPayload(order, productModel, config);
  if (!payload) return;
  await mail.sendOrderPlaced(payload);
}

export async function notifyCustomerStatusChange(
  order: OrderDocument,
  previousStatus: string,
  mail: MailService,
  productModel: Model<ProductDocument>,
  config: ConfigService,
) {
  if (!order.status || order.status === previousStatus) return;
  const payload = await buildOrderEmailPayload(order, productModel, config);
  if (!payload) return;
  payload.status = order.status;
  await mail.sendOrderStatusUpdate(payload);
}
