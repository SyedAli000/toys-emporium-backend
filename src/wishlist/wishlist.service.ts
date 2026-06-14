import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist, WishlistDocument } from '../schemas/wishlist.schema';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name) private wishlistModel: Model<WishlistDocument>,
  ) {}

  private async getOrCreate(userId: string) {
    let list = await this.wishlistModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!list) {
      list = await this.wishlistModel.create({
        userId: new Types.ObjectId(userId),
        productIds: [],
      });
    }
    return list;
  }

  async get(userId: string) {
    const list = await this.getOrCreate(userId);
    await list.populate('productIds');
    return {
      _id: list._id,
      productIds: list.productIds.map((p) =>
        typeof p === 'object' && p && '_id' in p
          ? {
              ...(p as object),
              _id: (p as { _id: Types.ObjectId })._id.toString(),
            }
          : p,
      ),
      products: list.productIds,
    };
  }

  async add(userId: string, productId: string) {
    const list = await this.getOrCreate(userId);
    const exists = list.productIds.some((id) => id.toString() === productId);
    if (!exists) {
      list.productIds.push(new Types.ObjectId(productId));
      await list.save();
    }
    return this.get(userId);
  }

  async remove(userId: string, productId: string) {
    const list = await this.getOrCreate(userId);
    list.productIds = list.productIds.filter(
      (id) => id.toString() !== productId,
    );
    await list.save();
    return this.get(userId);
  }
}
