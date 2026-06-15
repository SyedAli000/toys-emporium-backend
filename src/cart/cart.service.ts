import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from '../schemas/cart.schema';
import { Product, ProductDocument } from '../schemas/product.schema';
import { getSalePrice } from '../common/product-pricing';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  private async getOrCreate(userId: string) {
    let cart = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!cart) {
      cart = await this.cartModel.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }
    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreate(userId);
    await cart.populate('items.productId');
    let pricesUpdated = false;

    for (const item of cart.items) {
      const p = item.productId as unknown as ProductDocument;
      if (!p?._id) continue;
      const salePrice = getSalePrice(p);
      if (item.price !== salePrice) {
        item.price = salePrice;
        pricesUpdated = true;
      }
    }

    if (pricesUpdated) {
      await cart.save();
    }

    return {
      _id: cart._id,
      items: cart.items.map((item) => {
        const p = item.productId as unknown as ProductDocument;
        const salePrice = p?._id ? getSalePrice(p) : item.price;
        return {
          _id: (item as { _id?: Types.ObjectId })._id?.toString(),
          productId: p?._id?.toString() || item.productId.toString(),
          quantity: item.quantity,
          price: salePrice,
          product: p
            ? {
                _id: p._id.toString(),
                name: p.name || (p as unknown as { title?: string }).title,
                images: p.images || [],
                price: salePrice,
                originalPrice: Number(p.price ?? 0),
                discountPercentage: Number(p.discountPercentage ?? 0),
              }
            : null,
        };
      }),
    };
  }

  async addItem(userId: string, productId: string, quantity = 1) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    const stock = product.stock ?? 10;
    if (stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }
    const price = getSalePrice(product);
    const cart = await this.getOrCreate(userId);
    const existing = cart.items.find(
      (i) => i.productId.toString() === productId,
    );
    if (existing) {
      existing.quantity += quantity;
      existing.price = price;
    } else {
      cart.items.push({
        productId: new Types.ObjectId(productId),
        quantity,
        price,
      } as never);
    }
    await cart.save();
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.find(
      (i) => (i as { _id?: { toString(): string } })._id?.toString() === itemId,
    );
    if (!item) throw new NotFoundException('Cart item not found');
    if (quantity < 1) {
      cart.items = cart.items.filter(
        (i) =>
          (i as { _id?: { toString(): string } })._id?.toString() !== itemId,
      );
    } else {
      const product = await this.productModel.findById(item.productId);
      if (product && (product.stock ?? 0) < quantity) {
        throw new BadRequestException('Insufficient stock');
      }
      item.quantity = quantity;
      if (product) {
        item.price = getSalePrice(product);
      }
    }
    await cart.save();
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreate(userId);
    const before = cart.items.length;
    cart.items = cart.items.filter(
      (i) =>
        (i as { _id?: { toString(): string } })._id?.toString() !== itemId,
    );
    if (cart.items.length === before) throw new NotFoundException('Cart item not found');
    await cart.save();
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = [];
    await cart.save();
  }
}
