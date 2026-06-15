import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  private signToken(user: UserDocument) {
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return {
      token: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  toPublicUser(user: UserDocument | Record<string, unknown>) {
    const obj =
      typeof (user as UserDocument).toObject === 'function'
        ? (user as UserDocument).toObject()
        : { ...(user as Record<string, unknown>) };
    delete (obj as { password?: string }).password;
    return {
      _id: obj._id.toString(),
      email: obj.email,
      name: obj.name,
      role: obj.role,
      avatar:
        obj.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${obj.email}`,
      phone: obj.phone,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+password');
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.signToken(user);
  }

  async register(dto: RegisterDto) {
    const exists = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (exists) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: dto.password,
      role: 'customer',
    });
    return this.signToken(user);
  }

  async verify(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { user: this.toPublicUser(user) };
  }
}
