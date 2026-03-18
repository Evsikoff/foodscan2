import bridge from '@vkontakte/vk-bridge';

/**
 * Показывает рекламу за вознаграждение (reward),
 * а если она недоступна — обычную межстраничную (interstitial).
 */
export async function showNativeAd() {
  try {
    const data = await bridge.send('VKWebAppCheckNativeAds', { ad_format: 'reward' });
    if (data.result) {
      return await bridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
    }
  } catch (error) {
    console.error('Ошибка при проверке/показе reward-рекламы:', error);
  }

  // Фолбэк на обычную межстраничную рекламу
  return bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).catch((err) => {
    console.error('Ошибка при показе interstitial-рекламы:', err);
  });
}

/**
 * @deprecated Используйте showNativeAd для автоматического выбора формата
 */
export function showInterstitialAd() {
  return bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).catch(() => {});
}
