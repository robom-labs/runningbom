// GPS 러닝 추적 도메인의 공개 진입점입니다.
export { gpsTrackingEnabled, gpsUnavailableNotice } from './availability';
export {
  advanceDistanceCueState,
  initialDistanceCueState,
  nextDistanceCue,
  type DistanceCue,
  type DistanceCueState,
} from './cues';
export {
  acceptFix,
  accumulateFixes,
  defaultTrackFilterOptions,
  emptyTrackAccumulator,
  type FixRejectReason,
  type LocationFix,
  type TrackAccumulator,
  type TrackFilterOptions,
} from './filter';
export {
  haversineMeters,
  isValidGeoPoint,
  metersToKilometers,
  polylineMeters,
  roundedKilometers,
  type GeoPoint,
} from './geo';
export {
  averagePaceSecondsPerKm,
  currentPaceSecondsPerKm,
  formatDistanceKm,
  formatPace,
  paceSecondsPerKm,
  spokenDistanceKm,
  spokenPace,
} from './pace';
export {
  activateRunKeepAwake,
  deactivateRunKeepAwake,
  keepAwakeNotice,
  RUN_KEEP_AWAKE_TAG,
} from './keepAwake';
export {
  appendRouteFix,
  defaultRouteThinningOptions,
  downsampleRoute,
  emptyRouteState,
  routePointSummary,
  routePointsForActivity,
  type RouteState,
  type RouteThinningOptions,
} from './route';
export {
  gpsSignalLevel,
  signalLabels,
  trackedDistanceForActivity,
  trackingNotice,
  trackingSnapshot,
  type GpsSignalLevel,
  type TrackingNotice,
  type TrackingPermissionState,
  type TrackingSnapshot,
} from './session';
export {
  advanceSplits,
  fastestSplitIndex,
  finalSplits,
  initialSplitState,
  MIN_TRAILING_SPLIT_METERS,
  SPLIT_DISTANCE_METERS,
  splitDistanceKm,
  splitLabel,
  splitPaceSecondsPerKm,
  spokenSplit,
  trailingSplit,
  type SplitState,
} from './splits';
export {
  useRunTracking,
  type RunTracking,
  type TrackedActivityExtras,
} from './useRunTracking';
