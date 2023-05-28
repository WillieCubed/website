import GeneralLayout from '../../components/layouts/GeneralLayout';

export default function MainLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <GeneralLayout>{children}</GeneralLayout>
    </>
  );
}
