import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiArrowRight, HiX, HiArrowUp } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useChatContext } from '../../context/useChatContext';
import { ChatMessage, topics, FetchDatasetBody } from '../../types';
import Loader from '../Loader/Loader';
import _ from 'lodash';
import { useLayerContext } from '../../context/LayerContext';
import { t } from '../../i18n';


interface ChatProps {
  position?: string;
  topic?: topics;
  anchorRef?: React.RefObject<HTMLElement>;
}

const defaultProps = {
  position: `fixed lg:bottom-6 lg:end-6 bottom-4 end-4 `,
  topic: topics.DEFAULT,
};

function Chat(props: ChatProps = defaultProps) {
  const {
    messages,
    isLoading,
    isOpen,
    sendMessage,
    closeChat,
    clearChat,
    applyGradientColor,
    fetchDataset,
    topic,
    setTopic,
    setMessages,
  } = useChatContext();

  const { authResponse } = useAuth();

  const { setShowErrorMessage, handleFetchDataset, setCentralizeOnce } =
    useLayerContext();

  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userMessages = messages.filter(m => m.isUser).map(m => m.content);

  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [isFullDataLoading, setIsFullDataLoading] = useState(false);
  const [anchorStyle, setAnchorStyle] = useState<React.CSSProperties>({});
  const [dir, setDir] = useState(() => document.documentElement.dir || 'ltr');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDir(document.documentElement.dir || 'ltr');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!props.anchorRef?.current || window.innerWidth < 1024) {
      setAnchorStyle({});
      return;
    }
    if (!isOpen) {
      const id = setTimeout(() => setAnchorStyle({}), 500);
      return () => clearTimeout(id);
    }
    const rect = props.anchorRef.current.getBoundingClientRect();
    if (dir === 'rtl') {
      setAnchorStyle({ position: 'fixed', top: rect.top, right: window.innerWidth - rect.left + 8 });
    } else {
      setAnchorStyle({ position: 'fixed', top: rect.top, left: rect.right + 8 });
    }
  }, [isOpen, props.anchorRef, dir]);

  useEffect(() => {
    if (props.topic) setTopic(props.topic);
  }, [props.topic, setTopic]);

  useEffect(() => {
    setHistoryIndex(-1);
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().length < 1 || isLoading) return;
    setInput('');

    await sendMessage(input);
    setHistoryIndex(-1); // Reset history index after sending
    if (inputRef.current) {
      inputRef.current.style.height = '40px';
    }
  };

  const handleHistoryNavigation = () => {
    if (userMessages.length === 0) return;

    const nextIndex =
      historyIndex === -1
        ? userMessages.length - 1
        : (historyIndex - 1 + userMessages.length) % userMessages.length;

    setHistoryIndex(nextIndex);
    setInput(userMessages[nextIndex]);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.selectionStart = inputRef.current.value.length;
        inputRef.current.selectionEnd = inputRef.current.value.length;
      }
    }, 0);
  };

  const handleDatasetFetch = async (action: 'sample' | 'full data', responseBody: FetchDatasetBody) => {
    const countryName = responseBody.country_name || '';
    const cityName = responseBody.city_name || '';
    const booleanQuery = responseBody.boolean_query || '';

    if (!countryName || !cityName) {
      console.error('Country or city is missing in the response');
      const errorMessage: ChatMessage = {
        content: `Error: Country and city are required but not found in the AI response.`,
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      if (typeof setMessages === 'function') {
        setMessages(prev => [...prev, errorMessage]);
      }
      return;
    }

    try {
      const customBody = {
        user_id: authResponse?.localId || '',
        city_name: cityName,
        country_name: countryName,
        boolean_query: booleanQuery,
        action: action,
        search_type: 'category_search',
        layer_name: `${cityName} ${_.upperFirst(booleanQuery)}`,
      };

      if (action === 'sample') {
        setIsSampleLoading(true);
      } else {
        setIsFullDataLoading(true);
      }

      if (action === 'full data') {
        console.log('Setting centralizeOnce to true for full data');
        setCentralizeOnce(true);
      }

      await handleFetchDataset(action, undefined, undefined, undefined, customBody);

      const successMessage: ChatMessage = {
        content: action === 'full data'
          ? t("dataset-fetch-initiated-successfully-the-data-will-continue-loading-in-the-background")
          : t("dataset-fetch-initiated-successfully"),
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      if (typeof setMessages === 'function') {
        setMessages(prev => [...prev, successMessage]);
      }

      setTimeout(() => {
        closeChat();
      }, 2000);
    } catch (error) {
      console.error('Error in handleDatasetFetch:', error);
      setShowErrorMessage(true);

      const errorMessage: ChatMessage = {
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      if (typeof setMessages === 'function') {
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsSampleLoading(false);
      setIsFullDataLoading(false);
    }
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isBot = !message.isUser;
    const isLastMessage = index === messages.length - 1;
    const hasResponseData = isBot && message.responseData;

    const isValidResponse =
      hasResponseData &&
      (message.responseData.is_valid === true || message.responseData.is_valid === 'Valid');

    const isInvalidResponse =
      hasResponseData &&
      (message.responseData.is_valid === false || message.responseData.is_valid === 'Invalid');

    const isDatasetFetchResponse =
      isValidResponse &&
      topic === topics.DATASET &&
      message.responseData?.endpoint?.includes('fetch');

    const isRecolorResponse = isValidResponse && topic === topics.RECOLOR;

    return (
      <div
        key={index}
        className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4 ${isLastMessage ? 'animate-fade-in-up' : ''}`}
      >
        <div
          className={`${
            isBot
              ? 'bg-gray-100 rounded-2xl p-4 rounded-ss-none border border-gray-200'
              : 'bg-gem-gradient text-white rounded-2xl p-4 rounded-se-none'
          } ${isInvalidResponse ? 'bg-amber-50 border-amber-200' : ''} max-w-[85%]`}
        >
          {/* Message content */}
          <div className="whitespace-pre-wrap break-words overflow-wrap break-word">
            {message.content}
          </div>

          {/* Suggestions for invalid responses */}
          {isInvalidResponse && message.responseData.suggestions && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">{t("suggestions")}</p>
              <ul className="list-disc ps-5 mt-1">
                {message.responseData.suggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recolor response actions */}
          {isRecolorResponse && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  if (message.responseData?.endpoint && message.responseData?.body) {
                    applyGradientColor(message.responseData.endpoint, message.responseData.body);
                  }
                }}
                className="bg-gem-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gem-green/80 transition-colors"
              >{t("apply")}</button>
              <button
                onClick={() => {
                  clearChat();
                  closeChat();
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >{t("cancel")}</button>
            </div>
          )}

          {/* Dataset fetch response actions */}
          {isDatasetFetchResponse && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm text-gray-600 mb-1">{t("how-would-you-like-to-retrieve-this-data")}</p>
              <div className="flex gap-2">
                <button
                  disabled={isSampleLoading || isFullDataLoading}
                  onClick={() => {
                    if (message.responseData?.body) {
                      handleDatasetFetch('sample', message.responseData.body);
                    }
                  }}
                  className="bg-white border-2 border-[#115740] text-[#115740] px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  {isSampleLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-[#115740] rounded-full animate-spin"></span>
                  ) : (t("get-sample")
                  )}
                </button>
                <button
                  disabled={isSampleLoading || isFullDataLoading}
                  onClick={() => {
                    if (message.responseData?.body) {
                      handleDatasetFetch('full data', message.responseData.body);
                    }
                  }}
                  className="bg-[#115740] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#123f30] transition-colors"
                >
                  {isFullDataLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>{t("full-data")}{message.responseData?.cost
                        ? `($${parseFloat(message.responseData.cost).toFixed(2)})`
                        : ''}
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => {
                  clearChat();
                  closeChat();
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors mt-1"
              >{t("cancel")}</button>
            </div>
          )}

          {/* Generic valid response actions */}
          {isValidResponse && !isDatasetFetchResponse && !isRecolorResponse && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  if (message.responseData?.endpoint && message.responseData?.body) {
                    if (topic === topics.DATASET) {
                      fetchDataset(message.responseData.endpoint, message.responseData.body);
                    } else {
                      applyGradientColor(message.responseData.endpoint, message.responseData.body);
                    }
                  }
                }}
                className="bg-gem-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gem-green/80 transition-colors"
              >
                {topic === topics.DATASET ?t("fetch") :t("apply")}
              </button>
              <button
                onClick={() => {
                  clearChat();
                  closeChat();
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >{t("cancel")}</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasAnchorStyle = Object.keys(anchorStyle).length > 0;

  const chatContent = (
    <div
      className={`${hasAnchorStyle ? 'z-50' : props.position}
        lg:w-[400px] w-[95vw] max-h-[70vh] bg-white rounded-2xl shadow-xl
        transform-gpu transition-all duration-500 ease-out z-20
        ${isOpen ? '-translate-x-0 scale-100 opacity-100' : '-translate-x-1/4 scale-95 opacity-0 pointer-events-none'}`}
      style={hasAnchorStyle ? anchorStyle : undefined}
    >
      {/* Chat header */}
      <div className="flex items-center justify-between bg-gem-gradient-animated bg-200% animate-gradient-shift p-4 rounded-t-2xl">
        <h2 className="text-gray-100 font-semibold">{`AI ${_.upperFirst(topics[topic].toLowerCase())}`}</h2>
        <button
          onClick={closeChat}
          className="text-gray-100 hover:text-white transition-colors"
          aria-label={t("close-chat")}
        >
          <HiX className="w-6 h-6" />
        </button>
      </div>

      {/* Chat messages */}
      <div
        ref={containerRef}
        className="p-4 space-y-4 min-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        style={{ maxHeight: 'calc(70vh - 140px)' }}
      >
        {messages.map(renderMessage)}
        {isLoading && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="bg-gray-100 rounded-2xl p-4 rounded-ss-none border border-gray-200">
              <Loader />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleHistoryNavigation}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={t("browse-message-history")}
          >
            <HiArrowUp className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t("type-your-message")}
            className="flex-1 p-2 border-none focus:ring-0 focus:outline-none resize-none min-h-[40px] h-[40px] max-h-24 leading-6 overflow-y-auto scrollbar-hide"
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '40px'; // Reset height first
              target.style.height = `${Math.min(target.scrollHeight, 96)}px`; // Then adjust if needed
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isLoading}
            rows={1}
          />
          <button
            type="submit"
            disabled={input.trim().length < 1 || isLoading}
            className={`p-2 ${
              input.trim().length < 1 || isLoading
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gem-green hover:text-gem-green/80 transition-colors'
            }`}
            aria-label={t("send-message")}
          >
            <HiArrowRight className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </form>
    </div>
  );

  // Portal to document.body to escape BottomDrawer's transform context,
  // which breaks position:fixed on mobile
  return createPortal(chatContent, document.body);
}

export default Chat;
