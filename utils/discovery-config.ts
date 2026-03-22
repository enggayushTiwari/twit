export const DISCOVERY_COUNTRIES = [
  {
    id: "worldwide",
    label: "Worldwide",
    news: { hl: "en-US", gl: "US", ceid: "US:en" },
    xWoeid: "1",
  },
  {
    id: "us",
    label: "United States",
    news: { hl: "en-US", gl: "US", ceid: "US:en" },
    xWoeid: "23424977",
  },
  {
    id: "in",
    label: "India",
    news: { hl: "en-IN", gl: "IN", ceid: "IN:en" },
    xWoeid: "23424848",
  },
  {
    id: "gb",
    label: "United Kingdom",
    news: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
    xWoeid: "23424975",
  },
  {
    id: "jp",
    label: "Japan",
    news: { hl: "en", gl: "JP", ceid: "JP:en" },
    xWoeid: "23424856",
  },
] as const;

export const DISCOVERY_TOPICS = [
  { id: "general", label: "General", mode: "top", query: "" },
  { id: "technology", label: "Technology", mode: "section", query: "TECHNOLOGY" },
  { id: "business", label: "Business", mode: "section", query: "BUSINESS" },
  { id: "ai", label: "AI", mode: "search", query: "artificial intelligence OR generative AI OR OpenAI OR Gemini" },
  { id: "startups", label: "Startups", mode: "search", query: "startup OR startups OR founders OR venture capital" },
  { id: "finance", label: "Finance", mode: "search", query: "finance OR markets OR economy OR investing" },
  { id: "policy", label: "Policy", mode: "search", query: "policy OR regulation OR law OR government" },
] as const;

export const DISCOVERY_SOURCES = [
  { id: "all", label: "All sources" },
  { id: "news", label: "News" },
  { id: "x", label: "X only" },
] as const;

export type DiscoveryCountryId = (typeof DISCOVERY_COUNTRIES)[number]["id"];
export type DiscoveryTopicId = (typeof DISCOVERY_TOPICS)[number]["id"];
export type DiscoverySourceId = (typeof DISCOVERY_SOURCES)[number]["id"];

export function getDiscoveryCountry(id?: string) {
  return DISCOVERY_COUNTRIES.find((country) => country.id === id) || DISCOVERY_COUNTRIES[0];
}

export function getDiscoveryTopic(id?: string) {
  return DISCOVERY_TOPICS.find((topic) => topic.id === id) || DISCOVERY_TOPICS[0];
}

export function getDiscoverySource(id?: string): DiscoverySourceId {
  return DISCOVERY_SOURCES.find((source) => source.id === id)?.id || "all";
}
