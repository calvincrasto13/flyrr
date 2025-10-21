/**
 * Provide haptic/vibration feedback for user interactions
 * Falls back gracefully if vibration is not supported
 */
export const provideFeedback = (): void => {
  try {
    if ('vibrate' in navigator && navigator.vibrate) {
      navigator.vibrate(50); // 50ms vibration
    }
  } catch (error) {
    // Vibration not supported, silently fail
    // Visual feedback will still work via CSS
  }
};

/**
 * Add visual feedback class to an element temporarily
 * Used in conjunction with CSS animations for button presses
 */
export const addVisualFeedback = (element: HTMLElement | null): void => {
  if (!element) return;

  element.classList.add('feedback-active');

  setTimeout(() => {
    element.classList.remove('feedback-active');
  }, 100);
};

/**
 * Combined feedback: vibration + visual
 * Call this on button clicks and interactive elements
 */
export const provideFullFeedback = (element?: HTMLElement | null): void => {
  provideFeedback();
  if (element) {
    addVisualFeedback(element);
  }
};
