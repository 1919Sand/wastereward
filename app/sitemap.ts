import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { return ["", "/about", "/how-it-works", "/rewards", "/impact", "/faq", "/contact"].map(path => ({ url: `https://wastereward.in${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 })); }
