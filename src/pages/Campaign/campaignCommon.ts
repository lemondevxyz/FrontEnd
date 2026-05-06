import urls from '../../urls.json';
import { t } from '../../i18n';


// Shared types
export type Report = {
  id: number;
  title: string;
  description: string;
  icon?: string;
  bgImage?: string | null;
  options: {
    free_redirect: string;
    custom_redirect: string;
    open_page?: string;
  };
  coming_soon: boolean;
};

// Step definitions for campaign flow
export const CAMPAIGN_STEPS = [
  { id: 'select-report', title:t("choose-report") },
  { id: 'select-option', title:t("choose-option") },
];

// Shared constants
export const FONT_FAMILY = 'Montserrat, sans-serif';

// Shared API functions
export const fetchCampaigns = async (): Promise<Report[]> => {
  try {
    const response = await fetch(`${urls.REACT_APP_API_URL + urls.fetch_campaigns}`);
    const data: Report[] = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    throw error;
  }
};

// Shared utility functions
export const isTrySomethingElseReport = (report: Report): boolean => {
  return report.id === 4 || report.title === 'Try Something Else';
};

// Common navigation handlers
export const createNavigationHandlers = (
  navigate: (url: string) => void,
  setStep?: (step: number | ((prev: number) => number)) => void
) => {
  const handleFreeClick = (url: string) => {
    navigate(url);
  };

  const handleCustomClick = (url: string) => {
    navigate(url);
  };

  const handleBack = () => {
    if (!setStep) return;
    setStep(prev => Math.max(prev - 1, 0));
  };

  return {
    handleFreeClick,
    handleCustomClick,
    handleBack,
  };
};
