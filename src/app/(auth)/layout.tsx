import { AuthNav } from '@/components/auth/auth-nav';
import { DecorativeBackground } from '@/components/common/decorative-background';

/**
 * Public auth shell layout (login / register).
 *
 * A top navbar (brand + Login/Sign up switcher) over an ambient decorative
 * background, with the auth card centered below. Presentation only — the forms
 * wire their own auth logic.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <DecorativeBackground />
      <AuthNav />
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-12">
        <div className="w-full max-w-sm animate-fade-in-up">{children}</div>
      </div>
    </div>
  );
}
