import TopBar from '@/components/site/TopBar';

export default function PagesLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
