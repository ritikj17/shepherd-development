import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SHEPHERD — Safety Intelligence",
    short_name: "SHEPHERD",
    description:
      "A privacy-first workspace for documenting safety incidents, organizing evidence and coordinating trusted-contact check-ins.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f6f5f0",
    theme_color: "#101715",
    categories: ["safety", "productivity", "utilities"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/dashboard",
        description: "Workspace overview",
      },
      {
        name: "New incident",
        short_name: "New incident",
        url: "/incidents/new",
        description: "Create an incident record",
      },
      {
        name: "SafeCircle",
        short_name: "SafeCircle",
        url: "/safecircle",
        description: "Trusted contacts and check-ins",
      },
    ],
  };
}
