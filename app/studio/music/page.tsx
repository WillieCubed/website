import MusicAdmin from '@/components/music/MusicAdmin';

export const metadata = {
  title: 'Curate music',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <MusicAdmin />;
}
