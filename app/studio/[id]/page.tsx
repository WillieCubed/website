import StudioEditor from '@/components/studio/StudioEditor';
import '@/components/studio/studio.css';

export const metadata = {
  title: 'Writing studio',
};
export default async function Page({ params }: PageProps<'/studio/[id]'>) {
  const { id } = await params;
  return <StudioEditor id={id} />;
}
