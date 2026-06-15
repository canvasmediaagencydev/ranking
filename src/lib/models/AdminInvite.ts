import mongoose, { Schema, Document, Model } from 'mongoose';
import type { AdminRole } from './AdminUser';

export interface IAdminInvite extends Document {
  email: string;
  role: AdminRole;
  createdAt: Date;
  expiresAt: Date;
}

const AdminInviteSchema = new Schema<IAdminInvite>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

const AdminInvite: Model<IAdminInvite> =
  mongoose.models.AdminInvite ?? mongoose.model<IAdminInvite>('AdminInvite', AdminInviteSchema);

export default AdminInvite;
