import StudioEditor from '@/components/studio/StudioEditor';
import '@/components/studio/studio.css';

export const metadata = {
  title: 'Writing studio',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: PageProps<'/studio/[id]'>) {
  const { id } = await params;
  return <StudioEditor id={id} />;
}
