// Shared constants — port of config.py

export const DATABASE = process.env.APP_DATABASE || "SME_ANALYTICS_LATINIBERIA_ENGINEERING";
export const SCHEMA = process.env.APP_SCHEMA || "LAI_APP";
export const DB = `${DATABASE}.${SCHEMA}`;

export const LUMINATE_DATABASE = process.env.LUMINATE_DATABASE || "luminate_db_listing_detail";
export const LUMINATE_SCHEMA = process.env.LUMINATE_SCHEMA || "extract_s";

export const LUMINATE_MODELS_DATABASE = process.env.LUMINATE_MODELS_DATABASE || "LUMINATE_MODELS";
export const LUMINATE_MODELS_SCHEMA = process.env.LUMINATE_MODELS_SCHEMA || "PROD";

export const MAX_STEP = 8;
export const MIN_STEP = 1;

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const STEP_LABELS = [
  "Catalog select",
  "Resolve ambiguity",
  "Metadata to include",
  "Territory map",
  "Catalog analytics",
  "Revenue & PPD",
  "Album analytics",
  "Corporate export",
];
