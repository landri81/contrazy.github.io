import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Contrazy",
    short_name: "Contrazy",
    description:
      "Contract, KYC, signature, deposit and payment in one secure workflow.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0c1e2f",
    lang: "en",
    icons: [
      {
        src: "/logo/favicon-contrazy-64.png",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/logo/icon-contrazy-180.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo/icon-contrazy-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}