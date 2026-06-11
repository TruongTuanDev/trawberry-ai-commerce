export const ADS_MONITORING_ENABLED_FLAG = 'ADS_MONITORING_ENABLED';
export const ADS_INVALID_CLICK_RATE_ALERT_THRESHOLD_FLAG =
  'ADS_INVALID_CLICK_RATE_ALERT_THRESHOLD';
export const ADS_SPEND_SPIKE_ALERT_THRESHOLD_MINOR_FLAG =
  'ADS_SPEND_SPIKE_ALERT_THRESHOLD_MINOR';
export const ADS_SPEND_SPIKE_ALERT_THRESHOLD_MAJOR_FLAG =
  'ADS_SPEND_SPIKE_ALERT_THRESHOLD_MAJOR';

export const ADS_MONITORING_WINDOWS = ['1h', '24h', '7d'] as const;

export type AdsMonitoringWindow = (typeof ADS_MONITORING_WINDOWS)[number];

export const ADS_MONITORING_DEFAULTS = {
  invalidClickRateAlertThreshold: 0.3,
  spendSpikeAlertThresholdMinor: 5000,
  spendSpikeAlertThresholdMajor: 20000,
  invalidTokenCountAlertThreshold: 10,
  minimumClicksForRateAlert: 5,
} as const;
