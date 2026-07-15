import { Outlet } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';

export function AuthLayout() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-paper-soft">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #F5C51855 0%, transparent 40%), radial-gradient(circle at 80% 0%, #11111111 0%, transparent 35%)',
        }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 safe-pt safe-pb">
        <div className="mb-6 flex justify-center sm:mb-8">
          <Logo compact size="lg" />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
