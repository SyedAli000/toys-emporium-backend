import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/toysemporium';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'manager', 'customer', 'guest'],
      default: 'customer',
    },
    avatar: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const ProductSchema = new mongoose.Schema(
  {},
  { strict: false, timestamps: true, collection: 'products' },
);

const BannerSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    image: String,
    link: String,
    isActive: { type: Boolean, default: true },
    position: { type: Number, default: 0 },
  },
  { timestamps: true },
);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const User = mongoose.model('User', UserSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Banner = mongoose.model('Banner', BannerSchema);

  const demoUsers = [
    {
      email: 'demo@example.com',
      password: 'password123',
      name: 'Demo Customer',
      role: 'customer',
    },
    {
      email: 'manager@example.com',
      password: 'password123',
      name: 'Demo Manager',
      role: 'manager',
    },
    {
      email: 'admin@example.com',
      password: 'password123',
      name: 'Demo Admin',
      role: 'admin',
    },
  ];

  for (const u of demoUsers) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 10);
      await User.create({ ...u, password: hash } as never);
      console.log(`Created user: ${u.email}`);
    }
  }

  const categories = [
    { name: 'Action Figures', description: 'Heroes and action toys' },
    { name: 'Puzzles', description: 'Brain teasers' },
    { name: 'Board Games', description: 'Family fun' },
    { name: 'Video Games', description: 'Digital entertainment' },
  ];

  const categoryIds: mongoose.Types.ObjectId[] = [];
  for (const c of categories) {
    let cat = await Category.findOne({ name: c.name });
    if (!cat) cat = await Category.create(c);
    categoryIds.push(cat._id);
  }

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    for (let i = 1; i <= 12; i++) {
      const isFlash = i <= 4;
      await Product.create({
        name: `Toy Product ${i}`,
        description: `Amazing toy number ${i} for all ages.`,
        price: 19.99 + i * 5,
        stock: 50,
        category: categoryIds[i % categoryIds.length],
        images: [],
        ratings: 4 + (i % 10) / 10,
        reviews: 10 + i,
        isFeatured: i <= 4,
        isActive: true,
        isFlashSale: isFlash,
        discountPercentage: isFlash ? 15 + i * 2 : 0,
        hasReturn: i % 2 === 0,
        hasWarranty: i % 3 === 0,
        returnPolicy: '14 days easy return',
        warrantyText: '1 Year Warranty',
      } as never);
    }
    console.log('Seeded 12 products');
  } else {
    const products = await Product.find({});
    for (let idx = 0; idx < products.length; idx++) {
      const p = products[idx];
      let changed = false;
      if (!p.get('name') && p.get('title')) {
        p.set('name', p.get('title'));
        changed = true;
      }
      if (p.get('price') === undefined) {
        p.set('price', 29.99);
        changed = true;
      }
      if (p.get('stock') === undefined) {
        p.set('stock', 10);
        changed = true;
      }
      if (p.get('isActive') === undefined) {
        p.set('isActive', true);
        changed = true;
      }
      if (p.get('discountPercentage') === undefined) {
        p.set('discountPercentage', 0);
        changed = true;
      }
      if (p.get('isFlashSale') === undefined) {
        p.set('isFlashSale', false);
        changed = true;
      }
      if (idx < 4 && !p.get('isFlashSale') && !p.get('discountPercentage')) {
        p.set('isFlashSale', true);
        p.set('discountPercentage', 15 + idx * 5);
        changed = true;
      }
      if (changed) await p.save();
    }
    console.log(`Backfilled ${products.length} existing products`);
  }

  const bannerCount = await Banner.countDocuments();
  if (bannerCount === 0) {
    await Banner.create([
      {
        title: 'Summer Sale',
        description: 'Up to 50% off selected toys',
        image: 'https://placehold.co/1200x400/4F46E5/FFF?text=Summer+Sale',
        isActive: true,
        position: 0,
      },
    ]);
    console.log('Seeded banners');
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
