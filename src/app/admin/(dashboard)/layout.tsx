import { Sidebar } from './Sidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-token';

export const metadata = {
  title: 'Admin Dashboard | GOGRAPHY',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAdminToken(token) : null;

  if (!payload) {
    redirect('/admin/login');
  }

  return (
    <div data-theme="light" className="flex min-h-screen w-full bg-neutral-50 text-neutral-900">
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col w-full sm:pl-72">
        <AdminHeader />
        
        <main className="flex-1 p-6 sm:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
