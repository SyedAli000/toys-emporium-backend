import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private authService: AuthService,
  ) {}

  async findAll(query: Record<string, string>) {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }
    const users = await this.userModel.find(filter).sort({ createdAt: -1 }).lean();
    return users.map((u) => this.authService.toPublicUser(u as UserDocument));
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.authService.toPublicUser(user);
  }

  async update(id: string, data: Partial<User>) {
    const user = await this.userModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.authService.toPublicUser(user);
  }

  async updateStatus(id: string, isActive: boolean) {
    return this.update(id, { isActive } as Partial<User>);
  }
}
