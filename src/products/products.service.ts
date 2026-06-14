import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';

function normalizeProduct(doc: Record<string, unknown>) {
  const o = doc as ProductDocument & Record<string, unknown>;
  return {
    _id: o._id?.toString(),
    name: o.name || o.title || 'Unnamed Product',
    description: o.description || '',
    price: Number(o.price ?? o.salePrice ?? 0),
    cost: o.cost,
    category: o.category?.toString?.() || o.category,
    stock: Number(o.stock ?? o.quantity ?? 10),
    images: Array.isArray(o.images)
      ? o.images
      : o.image
        ? [o.image as string]
        : [],
    ratings: Number(o.ratings ?? o.rating ?? 0),
    reviews: Number(o.reviews ?? 0),
    tags: o.tags || [],
    isFeatured: Boolean(o.isFeatured ?? false),
    isActive: o.isActive !== false,
    isFlashSale: Boolean(o.isFlashSale ?? false),
    discountPercentage: Math.min(
      100,
      Math.max(0, Number(o.discountPercentage ?? 0)),
    ),
    hasReturn: Boolean(o.hasReturn ?? false),
    hasWarranty: Boolean(o.hasWarranty ?? false),
    returnPolicy: String(o.returnPolicy ?? '14 days easy return'),
    warrantyText: String(o.warrantyText ?? '1 Year Warranty'),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: Record<string, string>) {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = new Types.ObjectId(query.category);
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice)
        (filter.price as Record<string, number>).$gte = Number(query.minPrice);
      if (query.maxPrice)
        (filter.price as Record<string, number>).$lte = Number(query.maxPrice);
    }
    if (query.minRating) filter.ratings = { $gte: Number(query.minRating) };
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.activeOnly !== 'false') {
      filter.$and = [
        ...(filter.$and as unknown[] || []),
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
      ];
    }

    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (query.sort === 'price_asc') sort = { price: 1 };
    if (query.sort === 'price_desc') sort = { price: -1 };
    if (query.sort === 'rating') sort = { ratings: -1 };
    if (query.sort === 'flash_first') {
      sort = { isFlashSale: -1, discountPercentage: -1, createdAt: -1 };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [raw, total] = await Promise.all([
      this.productModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      products: raw.map((d) => normalizeProduct(d as unknown as Record<string, unknown>)),
      total,
      page,
      limit,
    };
  }

  async search(q: string) {
    return this.findAll({ search: q });
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Product not found');
    const doc = await this.productModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Product not found');
    return normalizeProduct(doc as unknown as Record<string, unknown>);
  }

  async create(data: Partial<Product>) {
    const created = await this.productModel.create(data);
    return normalizeProduct(created.toObject() as unknown as Record<string, unknown>);
  }

  async update(id: string, data: Partial<Product>) {
    const updated = await this.productModel
      .findByIdAndUpdate(id, data, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Product not found');
    return normalizeProduct(updated as unknown as Record<string, unknown>);
  }

  async remove(id: string) {
    const result = await this.productModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Product not found');
    return { message: 'Product deleted' };
  }

  async backfillDefaults() {
    const docs = await this.productModel.find({});
    for (const doc of docs) {
      let changed = false;
      const legacy = doc as unknown as { title?: string; salePrice?: number };
      if (doc.name === undefined && legacy.title) {
        doc.name = legacy.title;
        changed = true;
      }
      if (doc.price === undefined) {
        doc.price = Number(legacy.salePrice) || 0;
        changed = true;
      }
      if (doc.stock === undefined) {
        doc.stock = 10;
        changed = true;
      }
      if (doc.isActive === undefined) {
        doc.isActive = true;
        changed = true;
      }
      if (changed) await doc.save();
    }
    return { updated: docs.length };
  }
}
