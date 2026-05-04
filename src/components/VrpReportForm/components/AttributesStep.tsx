

import {
  FaHandshake,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useEffect, useState } from "react";
import { CustomReportData } from "../../../types";
import { t } from '../../../i18n';


interface CategoryItem {
  type: "predefined" | "custom";
  value: string;
}

interface SetAttributeStepProps {
  formData: CustomReportData;
  errors?: {
    target_population?: string;
    target_income?: string;
    competition?: string;
    complementary?: string;
  };
  onInputChange: (field: string, value: number | string | string[]) => void;
  disabled?: boolean;
  inputCategories: string[];
}

const SetAttributeStep = ({
  formData,
  onInputChange,
  disabled = false,
  inputCategories,
}: SetAttributeStepProps) => {
  const [searchComplementary, setSearchComplementary] = useState("");

  const [selectedComplementary, setSelectedComplementary] = useState<
    CategoryItem[]
  >([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [complementaryError, setComplementaryError] = useState<string | null>(
    null,
  );

  // Helper: Parse API format to internal CategoryItem format
  const parseFromApiFormat = (categories: string[]): CategoryItem[] => {
    return categories.map((cat) => {
      // Check if it's a custom keyword (wrapped with @)
      if (cat.startsWith("@") && cat.endsWith("@") && cat.length > 2) {
        const cleanValue = cat.slice(1, -1)
        return {
          type: "custom",
          value: cleanValue,
        };
      }
      return {
        type: "predefined",
        value: cat,
      };
    });
  };

  // Helper: Transform internal format to API format
  const transformToApiFormat = (items: CategoryItem[]): string[] => {
    return items.map((item) => {
      if (item.type === "custom") {
        return `@${item.value}@`;
      }
      return item.value;
    });
  };

  const validateKeywordInput = (
    value: string,
  ): { valid: boolean; error?: string } => {
    const trimmed = value.trim();

    if (trimmed.length < 2) {
      return { valid: false, error: t("keyword-must-be-at-least-2-characters") };
    }

    if (trimmed.length > 50) {
      return { valid: false, error: t("keyword-must-be-at-most-50-characters") };
    }

    return { valid: true };
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    searchValue: string,
    sectionKey: string,
    selectedItems: CategoryItem[],
    setSelectedItems: React.Dispatch<React.SetStateAction<CategoryItem[]>>,
    setSearchValue: React.Dispatch<React.SetStateAction<string>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    setError(null);

    const sanitized = searchValue.trim().replace(/^@+|@+$/g, "");

    if (!sanitized) {
      setError(t("please-enter-a-keyword"));
      return;
    }

    const validation = validateKeywordInput(sanitized);
    if (!validation.valid) {
      setError(validation.error || t("invalid-keyword"));
      return;
    }

    const isDuplicate = selectedItems.some(
      (item) => item.value.toLowerCase() === sanitized.toLowerCase(),
    );

    if (isDuplicate) {
      setError(t("this-keyword-is-already-added"));
      return;
    }

    const matchedCategory = categories.find(
      (cat) => cat.toLowerCase() === sanitized.toLowerCase(),
    );

    let newItem: CategoryItem;

    if (matchedCategory) {
      // Add as predefined category
      newItem = {
        type: "predefined",
        value: matchedCategory,
      };
    } else {
      // Add as custom keyword
      newItem = {
        type: "custom",
        value: sanitized,
      };
    }

    // Update state
    const updatedItems = [...selectedItems, newItem];
    setSelectedItems(updatedItems);

    // Transform and send to parent
    onInputChange(sectionKey, transformToApiFormat(updatedItems));

    // Clear search input
    setSearchValue("");
  };

  useEffect(() => {
    if (formData) {
      setSelectedComplementary(
        parseFromApiFormat([
          ...new Set(formData?.complementary_categories ?? []),
        ]),
      );
    }
  }, [formData]);

  useEffect(() => {
    setCategories(inputCategories);
  }, [inputCategories]);

  const getOrderedCategories = (
    query: string,
    categories: string[],
    selected: CategoryItem[],
  ): CategoryItem[] => {
    const filtered = categories.filter((cat) =>
      cat.toLowerCase().includes(query.toLowerCase()),
    );

    const predefinedItems: CategoryItem[] = filtered.map((cat) => ({
      type: "predefined",
      value: cat,
    }));

    const selectedPredefined = predefinedItems.filter((item) =>
      selected.some((s) => s.value === item.value && s.type === "predefined"),
    );
    const unselectedPredefined = predefinedItems.filter(
      (item) =>
        !selected.some(
          (s) => s.value === item.value && s.type === "predefined",
        ),
    );

    const customKeywords = selected.filter((item) => item.type === "custom");
    return  [...customKeywords, ...selectedPredefined, ...unselectedPredefined];
  };

  const toggleSelection = (
    key: string,
    item: CategoryItem,
    setSelected: React.Dispatch<React.SetStateAction<CategoryItem[]>>,
    selected: CategoryItem[],
  ) => {
    const isSelected = selected.some((s) => s.value === item.value);

    const updated = isSelected
      ? selected.filter((s) => s.value !== item.value)
      : [...selected, item];

    setSelected(updated);
    onInputChange(key, transformToApiFormat(updated));
  };

  return (
  
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-4 flex flex-col overflow-hidden max-h-[60vh]">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center flex-shrink-0">
            <FaHandshake className="w-4 h-4 me-2 text-primary" />{t("included-categories")}</h3>
          <input
            type="text"
            placeholder={t("search-categories-or-add-custom-keyword")}
            value={searchComplementary}
            onChange={(e) => setSearchComplementary(e.target.value)}
            onKeyDown={(e) =>
              handleKeyDown(
                e,
                searchComplementary,
                "complementary_categories",
                selectedComplementary,
                setSelectedComplementary,
                setSearchComplementary,
                setComplementaryError,
              )
            }
            disabled={disabled}
            className={`w-full border-2 rounded-xl px-3 py-2 mb-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 outline-none ${
              disabled
                ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                : "border-gray-200 hover:border-gray-300"
            }`}
          />

          {searchComplementary.trim() &&
            !categories.some(
              (cat) =>
                cat.toLowerCase() === searchComplementary.trim().toLowerCase(),
            ) && (
              <div className="text-xs text-blue-600 mb-2 px-3">{t("press-enter-to-add")}{searchComplementary.trim().replace(/^@+|@+$/g, "")}{t("as-custom-keyword")}</div>
            )}

          {complementaryError && (
            <div className="text-xs text-red-600 mb-2 px-3 flex items-center">
              <FaExclamationTriangle className="me-1" />
              {complementaryError}
            </div>
          )}

          <div className="flex flex-wrap gap-1 max-h-52 overflow-y-auto pe-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {getOrderedCategories(
              searchComplementary,
              inputCategories,
              selectedComplementary,
            ).map((item: CategoryItem) => {
              const isSelected = selectedComplementary.some(
                (s) => s.value === item.value,
              );

              return (
                <span
                  key={item.value}
                  onClick={() =>
                    !disabled &&
                    toggleSelection(
                      "complementary_categories",
                      item,
                      setSelectedComplementary,
                      selectedComplementary,
                    )
                  }
                  className={`px-2.5 py-1 text-sm rounded-full cursor-pointer border-2 transition-all ${
                    item.type === "custom"
                      ? isSelected
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400"
                      : isSelected
                        ? "bg-primary text-white border-primary"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
                  } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {item.value}
                </span>
              );
            })}
          </div>
        </div>
  )

};

export default SetAttributeStep;
