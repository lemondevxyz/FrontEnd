import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FaMapMarkedAlt, FaGift, FaFileAlt } from 'react-icons/fa';
import {
  Report,
  fetchCampaigns,
  isTrySomethingElseReport,
  createNavigationHandlers,
} from './campaignCommon';
import {
  SelectableCard,
  BackButton,
  LoadingState,
  ErrorState,
  PageHeader,
  HelpSection,
} from './CampaignComponents';
import { useUIContext } from '../../context/UIContext';
import urls from '../../urls.json';
import { DynamicIcon } from '../../utils/iconUtils';
import { t } from '../../i18n';


export default function CampaignHomePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preloadedImages, setPreloadedImages] = useState<Map<string, string>>(new Map()); // cache for preloaded images

  const navigate = useNavigate();
  const { closeModal } = useUIContext();

  const { handleFreeClick, handleCustomClick, handleBack } = createNavigationHandlers(
    navigate,
    setStep
  );

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchCampaigns()
      .then((data: Report[]) => {
        setReports(data);
        // Preload all background images when reports are loaded
        const imageCache = new Map<string, string>();
        const API_BASE = urls.REACT_APP_API_URL.replace("/fastapi","");
        
        data.forEach(report => {
          if (report.bgImage) {
            const imageUrl = report.bgImage.startsWith('http') 
              ? report.bgImage 
              : `${API_BASE}${report.bgImage}`;
            
            // Preload the image
            const img = new Image();
            img.src = imageUrl;
            imageCache.set(report.bgImage, imageUrl);
          }
        });
        
        setPreloadedImages(imageCache);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch reports:', err);
        setError(t("failed-to-load-reports-please-try-again"));
        setIsLoading(false);
      });
  }, []);

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    if(report.options.open_page) {
	    navigate(report.options.open_page);
    } else if (isTrySomethingElseReport(report)) {
      closeModal();
    } else {
      setStep(1);
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    fetchCampaigns()
      .then((data: Report[]) => {
        setReports(data);
        // Preload all background images when reports are loaded
        const imageCache = new Map<string, string>();
        const API_BASE = urls.REACT_APP_API_URL.replace("/fastapi","");
        
        data.forEach(report => {
          if (report.bgImage) {
            const imageUrl = report.bgImage.startsWith('http') 
              ? report.bgImage 
              : `${API_BASE}${report.bgImage}`;
            
            // Preload the image
            const img = new Image();
            img.src = imageUrl;
            imageCache.set(report.bgImage, imageUrl);
          }
        });
        
        setPreloadedImages(imageCache);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch reports:', err);
        setError(t("failed-to-load-reports-please-try-again"));
        setIsLoading(false);
      });
  };

  const API_BASE = urls.REACT_APP_API_URL.replace("/fastapi","");

  const resolveBgImage = (path?: string | null) => {
    if (!path) return undefined;
    // Use preloaded image if available, otherwise construct URL
    if (preloadedImages.has(path)) {
      return preloadedImages.get(path);
    }
    return path.startsWith('http') ? path : `${API_BASE}${path}`;
  };

  return (
    <div className="flex flex-col w-full h-full p-2 sm:p-4 overflow-y-auto max-h-[75vh]">
      {/* Page Header */}
      {step === 0 && (
        <PageHeader
          title={t("choose-your-report-type")}
          description={t("select-the-analysis-that-best-fits-your-business-needs")}
        />
      )}
      {step === 1 && (
        <PageHeader
          title={t("select-your-option")}
          description={t("choose-between-a-free-preview-or-a-custom-detailed-report")}
        />
      )}

      {/* Back Button */}
      {step > 0 && (
        <div className="mb-6">
          <BackButton onClick={handleBack} />
        </div>
      )}

      {/* Loading State */}
      {isLoading && <LoadingState message={t("loading-available-reports")} />}

      {/* Error State */}
      {error && <ErrorState message={error} onRetry={handleRetry} />}

      {/* Content */}
      {!isLoading && !error && (
        <>
          {/* Step 0: Report selection */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {reports.map((report, index) => (
                  <SelectableCard
                    key={report.id}
                    title={report.title}
                    description={report.description}
                    onClick={() => handleReportClick(report)}
                    icon={<DynamicIcon iconString={report.icon} fallbackIcon={FaMapMarkedAlt} className="w-6 h-6" />}
                    badge={index === 0 && !report.coming_soon ? t("popular") : undefined}
                    comingSoon={report.coming_soon}
                    bgImage={resolveBgImage(report.bgImage)}
                  />
                ))}
              </div>

              <HelpSection>
                <p className="font-medium mb-1">{t("need-help-deciding")}</p>
                <p className="text-xs text-gray-600">{t("each-report-provides-unique-insights-to-help-you-make-data-driven-location-decis")}</p>
              </HelpSection>
            </div>
          )}

          {/* Step 1: Free or Custom */}
          {step === 1 && selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SelectableCard
                  title={t("free-preview")}
                  description={t("explore-an-example-report-with-our-interactive-map-no-account-required")}
                  onClick={() => handleFreeClick(selectedReport.options.free_redirect)}
                  icon={<FaGift className="w-6 h-6" />}
                />
                <SelectableCard
                  title={t("custom-report")}
                  description={t("get-a-personalized-analysis-tailored-to-your-specific-location-and-business-needs")}
                  onClick={() => handleCustomClick(selectedReport.options.custom_redirect)}
                  icon={<FaFileAlt className="w-6 h-6" />}
                  recommended
                />
              </div>

              <HelpSection>
                <p className="text-xs text-gray-600">{t("the-free-preview-gives-you-a-sample-of-what-s-possible-create-a-custom-report-to")}</p>
              </HelpSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}
