import type { MetadataRoute } from "next"

/**
 * Web app manifest for the incREDible PWA, served by Next at
 * /manifest.webmanifest. Colors mirror the light theme in globals.css so the
 * standalone splash and status bar match the app chrome.
 *
 * Each icon entry lists several sizes for one 1024px master so the browser has
 * a valid 192 and 512 candidate (Chrome's installability requirement) without
 * shipping duplicate files. The maskable copy keeps its "RED" inside a safe
 * zone so Android's adaptive-icon mask never clips it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "incREDible",
    short_name: "incREDible",
    description: "The Pride Chamber's RED Group activity tracker.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [
      {
        src: "/icons/icon-app.png",
        sizes: "192x192 512x512 1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "192x192 512x512 1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
