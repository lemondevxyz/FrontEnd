import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdCheckCircleOutline, MdErrorOutline, MdArrowBack } from 'react-icons/md';
import { LiaMapMarkedAltSolid } from 'react-icons/lia';
import { useNavigate } from 'react-router-dom';
import { useAuth, isGuestUser } from '../../context/AuthContext';
import apiRequest from '../../services/apiRequest';
import urls from '../../urls.json';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';
import InlinePaymentMethod from '../CustomReportForm/components/InlinePaymentMethod';
import PhoneVerificationStep from '../CustomReportForm/components/PhoneVerificationStep';
import { formatSubcategoryName } from '../../utils/helperFunctions';
import { t } from '../../i18n';
import metaDataInformation from '../../data/metaDataInformation.json';


const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export interface IntelligencePurchaseItem {
  city_name: string;
  country_name: string;
  user_id: string;
  cost: number;
  expiration: string | null;
  explanation: string;
  is_currently_owned: boolean;
  free_as_part_of_package: boolean | null;
  description?: string;
  data_variables?: Record<string, string>;
  intelligence_name: string;
}

/** Resolve description and data_variables from local metaDataInformation when not supplied by API */
function resolveIntelligenceMeta(item: IntelligencePurchaseItem): {
  description: string;
  data_variables: Record<string, string>;
} {
  const intelKey = item.intelligence_name
    .replace(/ /g, '_')
    .toLowerCase() as keyof typeof metaDataInformation.intelligence;
  const meta = metaDataInformation.intelligence[intelKey];
  return {
    description: item.description ?? (meta ? t(meta.description_key) : ''),
    data_variables:
      item.data_variables ??
      (meta
        ? Object.fromEntries(
            Object.entries(meta.data_variables_description_keys).map(([k, tk]) => [k, t(tk)])
          )
        : {}),
  };
}

export interface DatasetPurchaseItem {
  city_name: string;
  country_name: string;
  user_id: string;
  cost: number;
  expiration: string | null;
  explanation?: string;
  is_currently_owned: boolean;
  free_as_part_of_package: boolean | null;
  description?: string;
  data_variables?: Record<string, string>;
  dataset_name: string;
}

interface CartCostData {
  total_cost: number;
  intelligence_purchase_items: IntelligencePurchaseItem[];
  dataset_purchase_items: DatasetPurchaseItem[];
  report_purchase_items: unknown[];
}

type IntelligencePaywallModalProps =
  | {
      onClose: () => void;
      onPurchaseSuccess: () => void;
      cartCostData: CartCostData;
      purchaseKind?: 'intelligence';
      intelligenceNames: string[];
    }
  | {
      onClose: () => void;
      onPurchaseSuccess: () => void;
      cartCostData: CartCostData;
      purchaseKind: 'dataset';
      datasetNames: string[];
      countryName: string;
      cityName: string;
    };

const formatPrice = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type InlineView = 'main' | 'add-payment' | 'add-funds' | 'verify-phone';

export const IntelligencePaywallModal: React.FC<IntelligencePaywallModalProps> = (props) => {
  const { onClose, onPurchaseSuccess, cartCostData } = props;
  const purchaseKind = props.purchaseKind ?? 'intelligence';
  const isDatasetKind = purchaseKind === 'dataset';
  const navigate = useNavigate();
  const { authResponse } = useAuth();
  const isGuest = !!authResponse && isGuestUser(authResponse);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [inlineView, setInlineView] = useState<InlineView>('main');
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  // When in add-payment view and phone is missing AND no existing payment method, show phone verification first
  const [paymentNeedsPhone, setPaymentNeedsPhone] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);

  // Fetch user profile (phone) and payment methods on mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!authResponse?.localId) {
        setProfileLoading(false);
        return;
      }
      try {
        // Fetch profile and payment methods in parallel
        const [profileRes, paymentRes] = await Promise.allSettled([
          apiRequest({
            url: urls.user_profile,
            method: 'POST',
            isAuthRequest: true,
            body: { user_id: authResponse.localId },
          }),
          apiRequest({
            url: `${urls.list_stripe_payment_methods}?user_id=${authResponse.localId}`,
            method: 'GET',
            isAuthRequest: true,
          }),
        ]);

        if (profileRes.status === 'fulfilled') {
          const profile = profileRes.value?.data?.data || profileRes.value?.data;
          const phone = profile?.phone || null;
          setUserPhone(phone && phone.trim() ? phone : null);
        }

        if (paymentRes.status === 'fulfilled') {
          const methods = paymentRes.value?.data?.data || paymentRes.value?.data;
          setHasPaymentMethod(Array.isArray(methods) && methods.length > 0);
        }
      } catch {
        // Non-critical
      } finally {
        setProfileLoading(false);
      }
    };
    fetchUserData();
  }, [authResponse?.localId]);

  // When entering add-payment, check if phone verification is needed
  // Skip if user already has a payment method on file
  useEffect(() => {
    if (inlineView === 'add-payment' && !profileLoading) {
      setPaymentNeedsPhone(!userPhone && !hasPaymentMethod);
    }
  }, [inlineView, profileLoading, userPhone, hasPaymentMethod]);

  const purchasableIntelligenceItems = cartCostData.intelligence_purchase_items.filter(
    item => !item.is_currently_owned
  );
  const purchasableDatasetItems = cartCostData.dataset_purchase_items.filter(
    item => !item.is_currently_owned
  );
  const purchasableCount = isDatasetKind
    ? purchasableDatasetItems.length
    : purchasableIntelligenceItems.length;

  const handlePurchase = useCallback(async () => {
    if (isGuest) {
      onClose();
      navigate('/auth?mode=register');
      return;
    }

    if (!authResponse?.localId) {
      onClose();
      navigate('/auth');
      return;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      const requestBody = {
        user_id: authResponse.localId,
        country_name: isDatasetKind ? props.countryName : '',
        city_name: isDatasetKind ? props.cityName : '',
        datasets: isDatasetKind ? props.datasetNames : ([] as string[]),
        intelligences: isDatasetKind ? ([] as string[]) : props.intelligenceNames,
        displayed_price: cartCostData.total_cost,
        report: '',
        report_potential_business_type: '',
      };

      await apiRequest({
        url: urls.purchase_items,
        method: 'POST',
        body: requestBody,
        isAuthRequest: true,
      });

      setPurchaseSuccess(true);
      setTimeout(() => {
        onPurchaseSuccess();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      let errorMessage = t("an-error-occurred-while-processing-your-purchase");

      if (err && typeof err === 'object' && 'response' in err) {
        const apiError = err as {
          response?: { data?: { message?: string; detail?: string; error?: string } | string };
        };
        const errorData = apiError.response?.data;

        if (errorData && typeof errorData === 'object') {
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message.replace(/\s*\(Status:\s*\d+\)/g, '');
      }

      // Route to inline flows based on error type
      const lowerError = errorMessage.toLowerCase();
      if (lowerError.includes('payment method') || lowerError.includes('paymentintent')) {
        if (!stripePromise) {
          toast.error(t("payment-system-is-unavailable-please-try-again-later-or-contact-support"));
          setError(t("payment-system-is-currently-unavailable"));
          return;
        }
        setError(t("no-payment-method-on-file-please-add-a-card-to-continue"));
        setInlineView('add-payment');
      } else if (lowerError.includes('insufficient balance') || lowerError.includes('wallet')) {
        setError(t("insufficient-funds-please-top-up-your-wallet-to-continue"));
        setInlineView('add-funds');
      } else if (lowerError.includes('phone') || lowerError.includes('verify')) {
        setError(t("phone-verification-required-please-verify-your-phone-number-first"));
        setInlineView('verify-phone');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsPurchasing(false);
    }
  }, [isGuest, authResponse, isDatasetKind, props, cartCostData.total_cost, onPurchaseSuccess, onClose, navigate]);

  // After inline flow completes, retry purchase
  const handlePaymentMethodAdded = useCallback(() => {
    setInlineView('main');
    setError(null);
    // Auto-retry purchase after adding payment method
    handlePurchase();
  }, [handlePurchase]);

  const handlePhoneVerified = useCallback((phone: string) => {
    setUserPhone(phone);
    setInlineView('main');
    setError(null);
    // Auto-retry purchase after phone verification
    setTimeout(() => handlePurchase(), 500);
  }, [handlePurchase]);

  const handleFundsAdded = useCallback(() => {
    setInlineView('main');
    setError(null);
    // Auto-retry purchase after adding funds
    handlePurchase();
  }, [handlePurchase]);

  const modalContent = (() => {
    // Success state
    if (purchaseSuccess) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
            <MdCheckCircleOutline className="text-green-500 text-6xl mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t("purchase-successful")}</h2>
            <p className="text-gray-600">
              {isDatasetKind
                ? t('activating-your-data-layers')
                : t('activating-your-intelligence-layer')}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header — gem gradient */}
          <div className="bg-gem-gradient px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {inlineView !=="main" && (
                  <button
                    onClick={() => { setInlineView('main'); setError(null); }}
                    className="text-white/70 hover:text-white transition-colors me-1"
                    aria-label={t("back")}
                  >
                    <MdArrowBack size={22} />
                  </button>
                )}
                <div className="bg-white/20 rounded-lg p-2">
                  <LiaMapMarkedAltSolid size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {inlineView ==="main"
                      ?t("you-discovered-a-premium-feature")
                      : inlineView ==="add-payment"
                        ? (paymentNeedsPhone ?t("verify-phone-number") :t("add-payment-method"))
                        : inlineView ==="add-funds"
                          ?t("add-funds")
                          :t("verify-phone-number")}
                  </h2>
                  <p className="text-sm text-white/80">
                    {isDatasetKind ? t('dataset-layers') : t('area-intelligence')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
                aria-label={t("close")}
              >
                <MdClose size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Inline: Add Payment Method (with phone verification gate) */}
            {inlineView ==="add-payment" && (
              paymentNeedsPhone ? (
                <PhoneVerificationStep
                  onVerificationSuccess={(phone) => {
                    setUserPhone(phone);
                    setPaymentNeedsPhone(false);
                  }}
                  compact
                  title={t("verify-your-phone")}
                  subtitle={t("a-verified-phone-number-is-required-before-adding-a-payment-method")}
                />
              ) : (
                <Elements stripe={stripePromise!}>
                  <InlinePaymentMethod
                    onPaymentMethodAdded={handlePaymentMethodAdded}
                    onCancel={() => { setInlineView('main'); setError(null); }}
                    userPhone={userPhone}
                  />
                </Elements>
              )
            )}

            {/* Inline: Add Funds */}
            {inlineView ==="add-funds" && (
              <InlineAddFunds
                onFundsAdded={handleFundsAdded}
                onCancel={() => { setInlineView('main'); setError(null); }}
              />
            )}

            {/* Inline: Phone Verification */}
            {inlineView ==="verify-phone" && (
              <PhoneVerificationStep
                onVerificationSuccess={handlePhoneVerified}
                compact
                title={t("verify-your-phone")}
                subtitle={t("phone-verification-is-required-to-complete-your-purchase")}
              />
            )}

            {/* Main purchase view */}
            {inlineView ==="main" && (
              <>
                {isGuest && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                    <p className="text-sm text-amber-800">{t("you-re-a-guest-user-please-sign-up-to-complete-your-purchase")}</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                    <div className="flex items-start gap-2">
                      <MdErrorOutline className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {(isDatasetKind ? purchasableDatasetItems : purchasableIntelligenceItems).map(
                    rawItem => {
                      const item = rawItem as IntelligencePurchaseItem & DatasetPurchaseItem;
                      const itemName = isDatasetKind ? item.dataset_name : item.intelligence_name;
                      const heading = isDatasetKind
                        ? formatSubcategoryName(itemName)
                        : `${itemName} ${t('intelligence')}`;
                      const intelligenceMeta = !isDatasetKind
                        ? resolveIntelligenceMeta(item)
                        : null;
                      const description = isDatasetKind
                        ? item.description
                        : intelligenceMeta?.description;
                      const dataVariables = isDatasetKind
                        ? item.data_variables
                        : intelligenceMeta?.data_variables;

                      return (
                        <div
                          key={itemName}
                          className="border border-gray-100 rounded-lg p-4 bg-gray-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
                              {description && (
                                <p className="text-sm text-gray-600 mt-1">{description}</p>
                              )}
                              {item.explanation && (
                                <p className="text-xs text-gray-500 mt-1 italic">
                                  {item.explanation}
                                </p>
                              )}
                              {item.expiration && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {t('valid-until')}{' '}
                                  {new Date(item.expiration).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="text-end ms-4">
                              {item.free_as_part_of_package ? (
                                <span className="text-lg font-bold text-green-600">
                                  {t('free')}
                                </span>
                              ) : (
                                <span className="text-lg font-bold text-[#115740]">
                                  {formatPrice(item.cost)}
                                </span>
                              )}
                            </div>
                          </div>

                          {dataVariables && Object.keys(dataVariables).length > 0 && (
                            <details className="mt-3">
                              <summary className="text-xs text-[#115740] cursor-pointer font-medium">
                                {t('view-included-data-variables')}
                                {Object.keys(dataVariables).length})
                              </summary>
                              <div className="mt-2 grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                                {Object.entries(dataVariables).map(([key, desc]) => (
                                  <div key={key} className="text-xs text-gray-600">
                                    <span className="font-medium text-gray-700">{key}</span>:{' '}
                                    {desc}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>

                {!isGuest && (
                  <div className="mt-4 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-500">{t("questions-reach-us-at")}{' '}
                      <a href="tel:+966558188632" className="text-[#115740] font-medium hover:underline">
                        +966 (55) 818 - 8632
                      </a>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — only show on main view */}
          {inlineView ==="main" && (
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600">{t("total")}</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(cartCostData.total_cost)}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                >{t("not-now")}</button>
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={isPurchasing || purchasableCount === 0}
                  className="flex-1 bg-[#115740] text-white py-3 rounded-lg font-semibold hover:bg-[#0d4632] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isPurchasing ?t("processing") : isGuest ?t("sign-up-to-purchase") :t("purchase-now")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  })();

  // Portal to document.body to escape any parent stacking contexts (BottomDrawer transform, sidebar z-index)
  return createPortal(modalContent, document.body);
};

/**
 * Inline wallet top-up component for the paywall modal.
 * Mirrors the AddFunds page but stays inside the modal.
 */
const InlineAddFunds: React.FC<{
  onFundsAdded: () => void;
  onCancel: () => void;
}> = ({ onFundsAdded, onCancel }) => {
  const { authResponse } = useAuth();
  const [cost, setCost] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCost(value);
      setInputError(null);
    } else {
      setInputError(t("enter-a-valid-amount-e-g-10-99"));
    }
  };

  const formatCost = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) return num.toFixed(2);
    return value;
  };

  const handleCostBlur = () => {
    if (cost && !isNaN(parseFloat(cost))) setCost(formatCost(cost));
  };

  const handleCostFocus = () => {
    const num = parseFloat(cost);
    if (!isNaN(num)) setCost(String(num));
    setInputError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputError) return;

    setErrorMessage(null);
    setSubmitting(true);

    try {
      const amount = parseFloat(cost);
      if (isNaN(amount) || amount <= 0) {
        setErrorMessage(t("please-enter-a-valid-amount"));
        setSubmitting(false);
        return;
      }

      if (!authResponse?.localId) {
        setErrorMessage(t("user-not-authenticated"));
        setSubmitting(false);
        return;
      }

      await apiRequest({
        url: urls.top_up_wallet,
        method: 'POST',
        body: {
          amount: amount * 100, // convert dollars to cents
          user_id: authResponse.localId,
        },
        isAuthRequest: true,
      });

      onFundsAdded();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("an-unexpected-error-occurred-please-try-again-later")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{t("top-up-your-wallet")}</h3>
        <p className="text-sm text-gray-600">{t("add-funds-to-your-wallet-to-complete-this-purchase")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="topup-amount" className="block text-sm font-medium text-gray-700 mb-1">{t("amount-usd")}</label>
          <input
            id="topup-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={cost}
            onChange={handleCostChange}
            onFocus={handleCostFocus}
            onBlur={handleCostBlur}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="0.00"
            required
          />
          {inputError && <p className="text-red-500 text-sm mt-1">{inputError}</p>}
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{errorMessage}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >{t("cancel")}</button>
          <button
            type="submit"
            disabled={submitting || !cost}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            {submitting ?t("processing") :t("add-funds")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IntelligencePaywallModal;
