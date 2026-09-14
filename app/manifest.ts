import type { MetadataRoute } from "next"

/**
 * Web app manifest for the incREDible PWA, served by Next at
 * /manifest.webmanifest. background_color mirrors the light theme so the
 * splash matches the app chrome, while theme_color is the brand red
 * (--primary in globals.css) so Android paints the standalone status bar red —
 * its white system text/icons are legible on red but disappear on the near-
 * white app background.
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
    theme_color: "#c1362d",
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
