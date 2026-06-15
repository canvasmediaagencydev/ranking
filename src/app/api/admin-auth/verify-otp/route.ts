import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AdminUser from '@/lib/models/AdminUser';
import AdminInvite from '@/lib/models/AdminInvite';
import OtpCode from '@/lib/models/OtpCode';
import { signAdminToken, COOKIE_NAME, EXPIRY_DAYS } from '@/lib/admin-token';
import type { AdminRole } from '@/lib/models/AdminUser';

export async function POST(request: Request) {
  try {
    const { email, code } = (await request.json()) as { email?: string; code?: string };
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    await connectDB();

    const otpDoc = await OtpCode.findOne({ email: normalizedEmail });
    if (!otpDoc || otpDoc.code !== code.trim()) {
      return NextResponse.json({ error: 'Invalid or expired OTP code.' }, { status: 401 });
    }
    if (otpDoc.expiresAt < new Date()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 401 });
    }

    // Consume OTP
    await OtpCode.deleteOne({ email: normalizedEmail });

    // Promote invite → AdminUser if needed
    let adminUser = await AdminUser.findOne({ email: normalizedEmail });
    if (!adminUser) {
      const invite = await AdminInvite.findOne({ email: normalizedEmail });
      if (!invite) {
        return NextResponse.json({ error: 'No admin access found for this email.' }, { status: 403 });
      }
      adminUser = await AdminUser.create({ email: normalizedEmail, role: invite.role as AdminRole });
      await AdminInvite.deleteOne({ email: normalizedEmail });
    }

    const token = await signAdminToken({ email: normalizedEmail, role: adminUser.role });

    const res = NextResponse.json({ ok: true, role: adminUser.role });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: EXPIRY_DAYS * 24 * 60 * 60,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
