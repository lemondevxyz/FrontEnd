import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCaretDown, FaCaretRight } from 'react-icons/fa';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { CategoriesBrowserSubCategoriesProps } from '../../types/allTypesAndInterfaces';
import { formatSubcategoryName } from '../../utils/helperFunctions';
import { t } from '../../i18n';

const PANEL_WIDTH_PX = 224; // 14rem
const PANEL_GAP_PX = 4;
const VIEWPORT_PADDING_PX = 8;

interface LayerAffectSelectProps {
  type: string;
  selectedLayerIds: number[];
  layers: { id: number; name: string }[];
  onToggleTypeInLayer: (type: string, layerId: number) => void;
  onCreateLayerWithType?: (type: string) => void;
}

function LayerAffectSelect({
  type,
  selectedLayerIds,
  layers,
  onToggleTypeInLayer,
  onCreateLayerWithType,
}: LayerAffectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Compute viewport position for the portal-rendered panel. Anchors to the trigger's
  // right edge and clamps to the viewport so it never gets clipped by any overflow
  // ancestor (e.g. the sidebar's `overflow-y-auto`).
  const recomputePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.right - PANEL_WIDTH_PX;
    const maxLeft = window.innerWidth - PANEL_WIDTH_PX - VIEWPORT_PADDING_PX;
    if (left > maxLeft) left = maxLeft;
    if (left < VIEWPORT_PADDING_PX) left = VIEWPORT_PADDING_PX;
    const top = rect.bottom + PANEL_GAP_PX;
    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    recomputePosition();
  }, [isOpen, recomputePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => recomputePosition();
    // Capture-phase scroll catches scrolls in any ancestor (sidebar, page).
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen, recomputePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const summary = selectedLayerIds.length
    ? selectedLayerIds.slice().sort((a, b) => a - b).join(', ')
    : '';

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-1 min-w-[2.25rem] h-7 px-2 rounded-md border border-gray-300 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <span className="leading-none">{summary || t('layers')}</span>
        <MdKeyboardArrowDown
          className={`text-base transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-multiselectable="true"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: PANEL_WIDTH_PX,
            }}
            className="z-[9999] max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg p-1"
            onClick={e => e.stopPropagation()}
          >
            {layers.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-gray-500">{t('no-layers-yet')}</p>
            )}
            {layers.map(layer => {
              const checked = selectedLayerIds.includes(layer.id);
              return (
                <label
                  key={layer.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleTypeInLayer(type, layer.id)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="font-semibold tabular-nums w-5 text-center">{layer.id}</span>
                  <span className="truncate">{layer.name || `Layer ${layer.id}`}</span>
                </label>
              );
            })}
            {onCreateLayerWithType && (
              <button
                type="button"
                onClick={() => {
                  onCreateLayerWithType(type);
                  setIsOpen(false);
                }}
                className="mt-1 w-full text-start px-2 py-1.5 rounded text-sm font-medium text-green-700 hover:bg-green-50 border-t border-gray-100"
              >
                + {t('create-new-layer')}
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

const CategoriesBrowserSubCategories = ({
  categories,
  openedCategories,
  onToggleCategory,
  getTypeCounts,
  layers,
  onToggleTypeInLayer,
  onCreateLayerWithType,
  getPrice,
  onTypeClick,
  hideAddRemoveButtons = false,
  selectedType,
}: CategoriesBrowserSubCategoriesProps) => {
  return (
    <div className="flex flex-col gap-2.5">
      {Object.entries(categories).map(([category, types]) => (
        <div key={category} className="flex-1 min-w-0">
          <button
            className="font-semibold text-lg cursor-pointer flex justify-start items-center w-full hover:bg-gray-200 transition-all rounded"
            onClick={() => onToggleCategory(category)}
          >
            <span>{openedCategories.includes(category) ? <FaCaretDown /> : <FaCaretRight />}</span>
            {formatSubcategoryName(category)}
          </button>

          <div
            className={
              'w-full basis-full overflow-hidden transition-all' +
              (!openedCategories.includes(category) && ' h-0')
            }
          >
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(types as string[]).map((type: string) => {
                const counts = getTypeCounts(type);
                const included = counts.includedCount.length > 0;
                const excluded = counts.excludedCount.length > 0;
                const isMixed = included && excluded;
                const isSelected = selectedType === type;

                const colors = isMixed
                  ? 'bg-[#FFE8D6] border-[#C86B31] text-[#CD5C08]'
                  : included
                    ? 'bg-[rgb(40,167,69)] border-[#167a1b] text-white'
                    : excluded
                      ? 'bg-[#ffebee] border-[#f44336] text-[#c62828]'
                      : '';

                const borderClass = isSelected
                  ? 'border-[#115740]'
                  : included || excluded
                    ? ''
                    : 'border-[#ccc]';

                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between gap-2 py-2 px-3 bg-[#f0f0f0] border rounded text-[14px] min-w-0 ${colors} ${borderClass} ${hideAddRemoveButtons ? 'cursor-pointer' : ''} transition-colors`}
                    onClick={() => hideAddRemoveButtons && onTypeClick?.(type)}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        onClick={() => onTypeClick?.(type)}
                        className={`break-words ${onTypeClick ? 'cursor-pointer hover:underline' : ''}`}
                      >
                        {formatSubcategoryName(type)}
                      </span>
                      {getPrice && <span className="text-xs mt-1 opacity-90">{getPrice(type)}</span>}
                    </div>

                    {!hideAddRemoveButtons && onToggleTypeInLayer && (
                      <LayerAffectSelect
                        type={type}
                        selectedLayerIds={counts.includedCount}
                        layers={layers || []}
                        onToggleTypeInLayer={onToggleTypeInLayer}
                        onCreateLayerWithType={onCreateLayerWithType}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoriesBrowserSubCategories;
