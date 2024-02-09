import { SpeedInsights } from '@vercel/speed-insights/next';

export default function MainLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <SpeedInsights />
      {children}
    </>
  );
}
