import ReactDOM from 'react-dom';
import { ModalProps } from '../../types';
import { useUIContext } from '../../context/UIContext';
import { t } from '../../i18n';


function Modal(props: ModalProps) {
  const {
    children,
    darkBackground = false,
    isSmaller = false,
    hasAutoSize = false,
    isHome = false,
  } = props;
  const { closeModal, isModalOpen } = useUIContext();

  if (!isModalOpen) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      id={'overlay'}
      className={`z-20 fixed top-0 start-0 end-0 bottom-0 flex justify-center items-center ${
        darkBackground ? 'bg-black/50' : ''
      } ${isSmaller ? 'pointer-events-none' : ''}`}
      onClick={e => {
        e.stopPropagation();
        if ((e.target as HTMLElement).id === 'overlay') {
          closeModal();
        }
      }}
    >
      <div
        className={`${isHome ? 'bg-white' : 'bg-white border shadow'} p-5 max-w-[950px] relative ${hasAutoSize ? 'w-auto' : 'w-full lg:h-5/6 h-full'} lg:rounded-lg  overflow-y-auto ${
          isSmaller
            ? 'flex justify-center items-center max-w-[400px] absolute inset-x-0 md:start-[140px]'
            : ''
        } pointer-events-auto`}
      >
        <button
          className={`${isHome ? 'text-white bg-red-600' : ''} transition-all text-xl w-10 h-10 hover:text-white font-bold hover:bg-red-600 absolute top-0 end-0 rounded-se-lg`}
          onClick={closeModal}
          aria-label={t('close-modal')}
        >
          &times;
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
