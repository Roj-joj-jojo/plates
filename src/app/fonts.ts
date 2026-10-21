import localFont from "next/font/local";

// Table and Plate titles
export const bricolage = localFont({
  src: "./font-assets/bricolage-grotesque.ttf",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

// Everything else. 500 is loaded because shadcn components use font-medium.
export const manrope = localFont({
  src: "./font-assets/manrope.ttf",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
});

// app/layout.tsx
//   import { bricolage, manrope } from "./fonts";
//   <html lang="en" className={`${bricolage.variable} ${manrope.variable}`}>
//
// Also export this from the root layout so the mobile keyboard resizes the page
// instead of covering the composer:
//   export const viewport = {
//     width: "device-width",
//     initialScale: 1,
//     viewportFit: "cover",
//     interactiveWidget: "resizes-content",
//   };
