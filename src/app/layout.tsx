import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MidiProvider } from "@/contexts/MidiContext";
import { NotationProvider } from "@/contexts/NotationContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tonnext - Interactive Tonnetz Visualization",
  description: "Explore musical relationships through interactive Tonnetz visualizations with MIDI playback",
  keywords: "tonnext, online, visualizer, visualization, generator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Cleanup Web Worker on page unload
              window.addEventListener('beforeunload', function() {
                // This will be handled by the cleanup function
              });
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <MidiProvider>
          <NotationProvider>
            <div className="min-h-screen bg-gray-900 text-white">
              {children}
            </div>
          </NotationProvider>
        </MidiProvider>
      </body>
    </html>
  );
}
