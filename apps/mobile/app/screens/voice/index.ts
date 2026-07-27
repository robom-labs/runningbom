// "목소리 고르기" 화면의 공개 입구입니다. 부모(라우터)는 이 파일만 보면 됩니다.
export {
  VoicePickerScreen,
  voicePickerScreenSubtitle,
  voicePickerScreenTitle,
} from './VoicePickerScreen';
export {
  coachVoicePickKey,
  defaultCoachVoicePick,
  loadCoachVoicePick,
  normalizeVoicePick,
  saveCoachVoicePick,
  type CoachVoicePick,
} from './voicePickStorage';
