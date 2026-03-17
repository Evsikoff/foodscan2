import bridge from '@vkontakte/vk-bridge';

export function showInterstitialAd() {
  return bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).catch(() => {});
}
