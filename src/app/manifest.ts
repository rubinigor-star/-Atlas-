import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas Office",
    short_name: "Atlas",
    description: "Управление мероприятиями, заявками и контролем входа",
    start_url: "/office",
    display: "standalone",
    background_color: "#081426",
    theme_color: "#081426",
    orientation: "portrait-primary",
    icons: [{ src: "/atlas-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
