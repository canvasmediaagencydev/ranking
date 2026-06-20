import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import connectDB from '@/lib/mongodb';
import AdminUser from '@/lib/models/AdminUser';
import AdminInvite from '@/lib/models/AdminInvite';
import OtpCode from '@/lib/models/OtpCode';

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    await connectDB();

    // Check admin user or pending invite
    const adminUser = await AdminUser.findOne({ email: normalizedEmail });
    const invite = !adminUser ? await AdminInvite.findOne({ email: normalizedEmail }) : null;

    if (!adminUser && !invite) {
      return NextResponse.json(
        { error: 'This email does not have admin access or a pending invite.' },
        { status: 403 },
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert OTP (replace any existing one)
    await OtpCode.findOneAndUpdate(
      { email: normalizedEmail },
      { email: normalizedEmail, code, expiresAt },
      { upsert: true, new: true },
    );

    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"GOGRAPHY SYSTEM" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: `[${code}] GOGRAPHY Admin Login Code`,
      html: `
        <div style="font-family: monospace; max-width: 480px; margin: 0 auto; padding: 40px; background: #fff; border: 1px solid #e5e5e5;">
          <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #888; margin-bottom: 32px;">
            GOGRAPHY SYSTEM — SECURE ACCESS
          </div>
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 0.3em; color: #111; margin-bottom: 24px;">
            ${code}
          </div>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px 0;">
            Enter this code in the admin login screen. It expires in 10 minutes.
          </p>
          <p style="font-size: 11px; color: #aaa; margin: 0;">
            If you did not request this code, ignore this email.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      ok: true,
      hasInvite: !!invite,
      role: adminUser?.role ?? invite?.role ?? 'admin',
    });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
