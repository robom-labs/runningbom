// 체험 로그인을 이 빌드에서 켜도 되는지(Preview 전용) 판단합니다.
//
// 판정 방법은 GPS 추적(domains/tracking/availability.ts)과 똑같습니다.
// app.config.js가 넣어 주는 extra.preview.enabled만 읽고, 새 설정 키를 만들지 않습니다.
import Constants from 'expo-constants';

import { trialLoginAllowed } from './trialLogin';

export function trialLoginEnabled(): boolean {
  return trialLoginAllowed(Constants.expoConfig?.extra?.preview?.enabled);
}
