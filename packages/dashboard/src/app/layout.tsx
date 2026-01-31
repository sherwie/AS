import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solana Meme Signal Bot',
  description: 'Early detection and analysis of Solana meme tokens',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-gray-100 min-h-screen">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <span className="text-xl font-bold text-white">
                  Solana Signal Bot
                </span>
              </div>
              <div className="flex space-x-4">
                <a href="/" className="text-gray-300 hover:text-white px-3 py-2">
                  Dashboard
                </a>
                <a href="/tokens" className="text-gray-300 hover:text-white px-3 py-2">
                  Tokens
                </a>
                <a href="/alerts" className="text-gray-300 hover:text-white px-3 py-2">
                  Alerts
                </a>
                <a href="/system" className="text-gray-300 hover:text-white px-3 py-2">
                  System
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
