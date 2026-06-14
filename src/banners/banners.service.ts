import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from '../schemas/banner.schema';

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
  ) {}

  findAll(activeOnly = false) {
    const filter = activeOnly ? { isActive: true } : {};
    return this.bannerModel.find(filter).sort({ position: 1 }).lean();
  }

  async findOne(id: string) {
    const b = await this.bannerModel.findById(id).lean();
    if (!b) throw new NotFoundException('Banner not found');
    return b;
  }

  create(data: Partial<Banner>) {
    return this.bannerModel.create(data);
  }

  async update(id: string, data: Partial<Banner>) {
    const updated = await this.bannerModel
      .findByIdAndUpdate(id, data, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Banner not found');
    return updated;
  }

  async remove(id: string) {
    const result = await this.bannerModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Banner not found');
    return { message: 'Banner deleted' };
  }
}
