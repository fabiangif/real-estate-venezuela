import type { MetadataRoute } from "next";
import { SITE } from "./sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    // los filtros van por query param y no deben generar URLs indexables (ROADMAP §2.2.7)
    rules: [{ userAgent: "*", allow: "/", disallow: ["/*?"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
