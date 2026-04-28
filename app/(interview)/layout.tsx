import { Toaster } from "sonner";

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toaster position="top-center" theme="system" />
      {children}
    </>
  );
}
