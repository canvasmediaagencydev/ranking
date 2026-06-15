import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOtpCode extends Document {
  email: string;
  code: string;
  expiresAt: Date;
}

const OtpCodeSchema = new Schema<IOtpCode>({
  email: { type: String, required: true, lowercase: true, trim: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

// One active OTP per email at a time
OtpCodeSchema.index({ email: 1 }, { unique: true });

const OtpCode: Model<IOtpCode> =
  mongoose.models.OtpCode ?? mongoose.model<IOtpCode>('OtpCode', OtpCodeSchema);

export default OtpCode;
