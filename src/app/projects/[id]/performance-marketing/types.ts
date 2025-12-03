// Marketing Types
export type MarketingChannel = 
  | "google_ads" | "meta_ads" | "linkedin_ads" | "tiktok_ads" 
  | "twitter_ads" | "microsoft_ads" | "organic_search" 
  | "organic_social" | "referral" | "direct" | "email" | "other";

export type Campaign = {
  id: string;
  name: string;
  channel: MarketingChannel;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  is_active: boolean;
  created_at: string;
};

export type ExpenseLog = {
  id: string;
  project_id: string;
  campaign_id: string | null;
  date_start: string;
  date_end: string;
  channel: MarketingChannel;
  campaign_name: string;
  spend_amount: number;
  currency: string;
  manual_clicks: number | null;
  manual_impressions: number | null;
  manual_conversions: number | null;
  notes: string | null;
  import_source: string;
  created_at: string;
  // Geo fields
  country: string | null;
  region: string | null;
  city: string | null;
};

export type MarketingLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  channel: MarketingChannel | null;
  lead_source: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  fbclid: string | null;
  deal_value: number | null;
  deal_status: string | null;
  converted_at: string | null;
  created_at: string;
  // Geo fields
  country: string | null;
  region: string | null;
  city: string | null;
};

export type Project = {
  id: string;
  name: string;
};

export type Tab = "expenses" | "campaigns" | "leads" | "reports" | "exports";

export const CHANNELS: { value: MarketingChannel; label: string }[] = [
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta (Facebook/Instagram)" },
  { value: "linkedin_ads", label: "LinkedIn Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "twitter_ads", label: "Twitter/X Ads" },
  { value: "microsoft_ads", label: "Microsoft Ads" },
  { value: "organic_search", label: "Organic Search" },
  { value: "organic_social", label: "Organic Social" },
  { value: "referral", label: "Referral" },
  { value: "direct", label: "Direct" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

export const LEAD_SOURCES = [
  "Google Search",
  "Google Display",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "TikTok",
  "Twitter/X",
  "YouTube",
  "Referral",
  "Word of Mouth",
  "Trade Show",
  "Cold Outreach",
  "Website",
  "Other",
];

export const GCC_COUNTRIES = [
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
];

export const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export const COMMON_COUNTRIES = [
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Egypt",
  "Jordan",
  "Lebanon",
  "India",
  "Pakistan",
  "Philippines",
  "United Kingdom",
  "United States",
  "Germany",
  "France",
  "Other",
];

export const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat().format(Math.round(value));
};

export const getChannelLabel = (channel: string) => {
  return CHANNELS.find(c => c.value === channel)?.label || channel;
};
