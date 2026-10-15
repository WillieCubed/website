import StudioLibrary from '@/components/studio/StudioLibrary';
import '@/components/studio/studio.css';

export const metadata = {
  title: 'Writing studio',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StudioLibrary />;
}
