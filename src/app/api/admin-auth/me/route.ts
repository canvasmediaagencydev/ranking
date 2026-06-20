import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-token';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ admin: null });

  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ admin: null });

  return NextResponse.json({ admin: { email: payload.email, role: payload.role } });
}
