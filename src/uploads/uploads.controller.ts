import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const uploadDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin', 'manager')
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const port = process.env.PORT || 3001;
    const base =
      process.env.API_PUBLIC_URL ||
      process.env.FRONTEND_URL?.replace(':3000', `:${port}`) ||
      `http://localhost:${port}`;
    const root = base.replace(/\/api\/?$/, '');
    return {
      url: `${root}/uploads/${file.filename}`,
      filename: file.filename,
    };
  }
}
