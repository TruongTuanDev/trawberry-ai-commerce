function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "off", "no"].includes(value.toLowerCase());
}

const LOCAL_STORAGE_PUBLIC_FLAG = "trawberry_visual_search_enabled";
const LOCAL_STORAGE_TRACKING_FLAG = "trawberry_visual_search_tracking_enabled";

export function getVisualSearchFlags() {
  const visualSearchEnabled = readBoolean(
    process.env.VISUAL_SEARCH_ENABLED,
    false,
  );
  const publicVisualSearchEnabled = readBoolean(
    process.env.PUBLIC_VISUAL_SEARCH_ENABLED ??
      process.env.NEXT_PUBLIC_VISUAL_SEARCH_ENABLED,
    false,
  );
  const visualSearchTrackingEnabled = readBoolean(
    process.env.VISUAL_SEARCH_TRACKING_ENABLED,
    false,
  );

  return {
    publicVisualSearchEnabled:
      visualSearchEnabled && publicVisualSearchEnabled,
    visualSearchTrackingEnabled:
      visualSearchEnabled && visualSearchTrackingEnabled,
  };
}

export function readVisualSearchFlagsFromDocument() {
  if (typeof document === "undefined") {
    return {
      publicVisualSearchEnabled: false,
      visualSearchTrackingEnabled: false,
    };
  }

  const storagePublicFlag = window.localStorage.getItem(LOCAL_STORAGE_PUBLIC_FLAG);
  const storageTrackingFlag = window.localStorage.getItem(LOCAL_STORAGE_TRACKING_FLAG);
  const publicVisualSearchEnabled =
    storagePublicFlag === null
      ? document.body.dataset.publicVisualSearchEnabled === "true"
      : readBoolean(storagePublicFlag, false);
  const visualSearchTrackingEnabled =
    storageTrackingFlag === null
      ? document.body.dataset.visualSearchTrackingEnabled === "true"
      : readBoolean(storageTrackingFlag, false);

  return {
    publicVisualSearchEnabled,
    visualSearchTrackingEnabled,
  };
}
