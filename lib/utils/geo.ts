import { Geo } from "../types";

export function getGeoData(headers: {
  [key: string]: string | string[] | undefined;
}): Geo {
  return {
    city: Array.isArray(headers["x-vercel-ip-city"])
      ? headers["x-vercel-ip-city"][0]
      : headers["x-vercel-ip-city"],
    region: Array.isArray(headers["x-vercel-ip-region"])
      ? headers["x-vercel-ip-region"][0]
      : headers["x-vercel-ip-region"],
    country: Array.isArray(headers["x-vercel-ip-country"])
      ? headers["x-vercel-ip-country"][0]
      : headers["x-vercel-ip-country"],
    latitude: Array.isArray(headers["x-vercel-ip-latitude"])
      ? headers["x-vercel-ip-latitude"][0]
      : headers["x-vercel-ip-latitude"],
    longitude: Array.isArray(headers["x-vercel-ip-longitude"])
      ? headers["x-vercel-ip-longitude"][0]
      : headers["x-vercel-ip-longitude"],
  };
}

export const LOCALHOST_GEO_DATA = {
  continent: "Europe",
  city: "Munich",
  region: "BY",
  country: "DE",
  latitude: "48.137154",
  longitude: "11.576124",
};

export const LOCALHOST_IP = "127.0.0.1";

// Lazy-loaded geoip module to avoid loading data files at build time
let geoipModule: typeof import("geoip-lite") | null = null;

async function getGeoipModule() {
  if (!geoipModule) {
    geoipModule = await import("geoip-lite");
  }
  return geoipModule;
}

/**
 * Lookup geolocation data using geoip-lite with Munich fallback
 * Uses dynamic import to avoid loading geoip data files during Next.js build
 */
export async function getGeoFromIP(ip: string | null): Promise<{
  city: string;
  region: string;
  country: string;
  latitude: string;
  longitude: string;
  continent: string;
}> {
  if (!ip || ip === LOCALHOST_IP || ip === "::1") {
    return LOCALHOST_GEO_DATA;
  }

  try {
    const geoip = await getGeoipModule();
    const geo = geoip.lookup(ip);
    if (geo) {
      return {
        city: geo.city || LOCALHOST_GEO_DATA.city,
        region: geo.region || LOCALHOST_GEO_DATA.region,
        country: geo.country || LOCALHOST_GEO_DATA.country,
        latitude: geo.ll?.[0]?.toString() || LOCALHOST_GEO_DATA.latitude,
        longitude: geo.ll?.[1]?.toString() || LOCALHOST_GEO_DATA.longitude,
        continent: LOCALHOST_GEO_DATA.continent, // geoip-lite doesn't provide continent
      };
    }
  } catch (error) {
    console.error("GeoIP lookup failed, using fallback:", error);
  }

  // Fallback to Munich if lookup fails
  return LOCALHOST_GEO_DATA;
}
