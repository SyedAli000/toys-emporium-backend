import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User, UserDocument } from '../schemas/user.schema';
import {
  PasswordReset,
  PasswordResetDocument,
} from '../schemas/password-reset.schema';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PasswordReset.name)
    private resetModel: Model<PasswordResetDocument>,
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

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return { message: 'If the email exists, a reset link was sent' };
    }
    const token = randomBytes(32).toString('hex');
    await this.resetModel.deleteMany({ email: email.toLowerCase() });
    await this.resetModel.create({
      email: email.toLowerCase(),
      token,
      expiresAt: new Date(Date.now() + 3600000),
    });
    console.log(
      `[dev] Password reset for ${email}: POST /api/auth/reset-password with token=${token}`,
    );
    return { message: 'If the email exists, a reset link was sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.resetModel.findOne({ token: dto.token });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const user = await this.userModel
      .findOne({ email: record.email })
      .select('+password');
    if (!user) throw new NotFoundException('User not found');
    user.password = dto.password;
    await user.save();
    await this.resetModel.deleteMany({ email: record.email });
    return { message: 'Password updated successfully' };
  }
}
