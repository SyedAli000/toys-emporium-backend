import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  findAll() {
    return this.categoryModel.find().sort({ name: 1 }).lean();
  }

  async findOne(id: string) {
    const cat = await this.categoryModel.findById(id).lean();
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  create(data: Partial<Category>) {
    return this.categoryModel.create(data);
  }

  async update(id: string, data: Partial<Category>) {
    const updated = await this.categoryModel
      .findByIdAndUpdate(id, data, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async remove(id: string) {
    const result = await this.categoryModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Category not found');
    return { message: 'Category deleted' };
  }
}
