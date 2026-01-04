import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: {
    template: '%s | Invoicify Dashboard',
    default: 'Invoicify Dashboard',
  },
  description: 'Invoicify Dashboard built with App Router.',
  metadataBase: new URL('https://next-learn-dashboard.vercel.sh'),
};
 
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-slate-950 text-slate-100`}>
        {children}
      </body>
    </html>
  );
}
