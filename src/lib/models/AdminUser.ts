import mongoose, { Schema, Document, Model } from 'mongoose';

export type AdminRole = 'admin' | 'super_admin';

export interface IAdminUser extends Document {
  email: string;
  role: AdminRole;
  createdAt: Date;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
  },
  { timestamps: true }
);

const AdminUser: Model<IAdminUser> =
  mongoose.models.AdminUser ?? mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);

export default AdminUser;
