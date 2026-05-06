import { t } from '../i18n';

export function formatSubcategoryName(name: string | undefined | null): string {
  if (!name) return '';
  const translated = t(name);
  if (translated !== name) return translated;

  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes a category type for search (underscores to spaces, lowercase).
 */
function normalizeTypeForSearch(type: string): string {
  return (type || '').replace(/_/g, ' ').toLowerCase();
}

/**
 * Normalizes search query: trims and collapses multiple spaces so spaces are allowed.
 */
function normalizeSearchQuery(query: string): string {
  return (query || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Returns true if needle is a subsequence of haystack (all chars of needle appear in order in haystack).
 * Enables fuzzy matching e.g. "rntl" matches "rental", "cr" matches "car".
 */
function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/**
 * Fuzzy match: type matches search query when every space-separated token
 * in the query appears in the normalized type (as substring or subsequence).
 * - Allows spaces: multi-word queries work (e.g. "Car Rental" matches "Car_Rental").
 * - Fuzzy: each token can match as subsequence (e.g. "cr rntl" matches "Car Rental").
 */
export function fuzzyMatchCategoryType(type: string, searchQuery: string): boolean {
  const normalized = normalizeTypeForSearch(type);
  const query = normalizeSearchQuery(searchQuery);
  if (!query) return true;
  const tokens = query.split(' ').filter(Boolean);
  return tokens.every(
    token => normalized.includes(token) || isSubsequence(token, normalized)
  );
}

export function processCityData(
  data: Record<string, unknown>,
  setData: (value: Record<string, unknown>) => void
): string[] {
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    setData(data);
    return keys;
  }
  return [];
}

export const colorOptions = [
  { name: 'Red', hex: '#FF5733' },
  { name: 'Green', hex: '#28A745' },
  { name: 'Blue', hex: '#007BFF' },
  { name: 'Yellow', hex: '#FFC107' },
  { name: 'Black', hex: '#343A40' },
];

export const colorMap = new Map(colorOptions.map(color => [color.hex, color.name]));

export const getDefaultLayerColor = (layerId: number): string => {
  return colorOptions[layerId % colorOptions.length]?.hex || '#28A745';
};

export function isValidColor(color: string): boolean {
  // Check if the color is a valid hex color
  const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
  if (hexColorRegex.test(color)) {
    return true;
  }

  // Check if the color is a valid named color using CSS
  const option = document.createElement('div');
  option.style.color = color;
  return option.style.color !== '';
}

export const handleWhatsAppClick = ({
  phoneNumber,
  message,
}: {
  phoneNumber: string | undefined;
  message: string | undefined;
}) => {
  const encodedMessage = message ? encodeURIComponent(message) : '';
  if (!phoneNumber) throw new Error(t("phone-number-is-required"));

  const whatsappUrl = `https://wa.me/${phoneNumber}${encodedMessage ? `?text=${encodedMessage}` : ''}`;

  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
};

export const getPriceNumber = (price: number | null, isLoading: boolean = false): string => {
  if (price === null) return 'N/A';
  if (isLoading) return '...';
  return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const getYesterdayDate = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString();
};
