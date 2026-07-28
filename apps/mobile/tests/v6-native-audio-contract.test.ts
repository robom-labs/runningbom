// V6 코치가 세션 전체가 아닌 실제 발화 동안만 오디오 포커스를 쓰는지 검증합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const serviceSource = readFileSync(
  join(
    __dirname,
    '..',
    'modules/runningbom-coach/android/src/main/java/expo/modules/runningbomcoach/RunningbomCoachService.kt',
  ),
  'utf8',
);
const iosRuntimeSource = readFileSync(
  join(
    __dirname,
    '..',
    'modules/runningbom-coach/ios/RunningbomCoachRuntime.swift',
  ),
  'utf8',
);
const iosSessionSource = readFileSync(
  join(
    __dirname,
    '..',
    'modules/runningbom-coach/ios/RunningbomAudioSession.swift',
  ),
  'utf8',
);
const appConfig = readFileSync(join(__dirname, '..', 'app.json'), 'utf8');
const coachService = readFileSync(
  join(__dirname, '..', 'services/audio/coachService.ts'),
  'utf8',
);
const startScreen = readFileSync(
  join(__dirname, '..', 'app/screens/start/StartScreen.tsx'),
  'utf8',
);

test('Android 코치는 발화 직전에만 일시적 duck 포커스를 요청합니다', () => {
  assert.ok(serviceSource.includes('AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK'));
  assert.ok(serviceSource.includes('setAcceptsDelayedFocusGain(false)'));
  assert.ok(!serviceSource.includes('AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)'));
  assert.ok(
    serviceSource.indexOf('if (!requestSpeechAudioFocus()) return') <
      serviceSource.indexOf('nextCueIndex = candidateIndex'),
    '포커스 확보 전에 대사를 소비합니다',
  );
});

test('발화가 끝나거나 실패하거나 중단되면 오디오 포커스를 반환합니다', () => {
  const utteranceCallbacks = serviceSource.slice(
    serviceSource.indexOf('setOnUtteranceProgressListener'),
    serviceSource.indexOf('private fun selectBestInstalledKoreanVoice'),
  );
  for (const callback of ['onDone', 'onError', 'onStop']) {
    const start = utteranceCallbacks.indexOf(`override fun ${callback}`);
    assert.ok(start >= 0, `${callback} 콜백이 없습니다`);
    const body = utteranceCallbacks.slice(start, start + 420);
    assert.ok(body.includes('releaseSpeechFocusWhenIdle'), `${callback}에서 포커스를 반환하지 않습니다`);
  }
});

test('오픈엔드 네이티브 세션은 예정 분량 끝에서 자동 완료되지 않습니다', () => {
  assert.ok(serviceSource.includes('if (!openEnded && elapsed >= durationSeconds)'));
  assert.ok(serviceSource.includes('return if (openEnded) elapsed'));
  assert.ok(serviceSource.includes('.putBoolean("openEnded", openEnded)'));
});

test('iOS 코치는 단조 시계·기기 TTS·백그라운드 오디오를 네이티브에서 소유합니다', () => {
  assert.match(iosRuntimeSource, /ProcessInfo\.processInfo\.systemUptime/);
  assert.match(iosRuntimeSource, /AVSpeechSynthesizer/);
  assert.match(iosRuntimeSource, /DispatchSource\.makeTimerSource/);
  assert.match(iosRuntimeSource, /startBackgroundClock/);
  assert.match(iosRuntimeSource, /scheduleBuffer\(buffer, at: nil, options: \[\.loops\]\)/);
  assert.match(appConfig, /"UIBackgroundModes"/);
  assert.match(appConfig, /"audio"/);
  assert.doesNotMatch(iosRuntimeSource, /Timer\.scheduledTimer|setTimeout|setInterval/);
});

test('iOS 코치는 통화·이어폰 중단을 처리하고 발화가 끝나면 duck 소유권을 반환합니다', () => {
  assert.match(iosRuntimeSource, /interruptionNotification/);
  assert.match(iosRuntimeSource, /routeChangeNotification/);
  assert.match(iosRuntimeSource, /oldDeviceUnavailable/);
  assert.match(iosRuntimeSource, /didFinish utterance/);
  assert.match(iosRuntimeSource, /didCancel utterance/);
  assert.match(iosSessionSource, /\.duckOthers/);
  assert.match(iosSessionSource, /notifyOthersOnDeactivation/);
});

test('JavaScript 서비스는 Android와 iOS에서 네이티브 코치를 사용합니다', () => {
  assert.match(coachService, /Platform\.OS === 'android' \|\| Platform\.OS === 'ios'/);
});

test('복원 화면은 오래된 사용자 설정이 아니라 네이티브 런타임의 오픈엔드 상태를 따릅니다', () => {
  const restoreBlock = startScreen.slice(
    startScreen.indexOf('const refreshRuntime'),
    startScreen.indexOf('const startRun'),
  );
  assert.match(restoreBlock, /if \(!next\.openEnded\)/);
  assert.doesNotMatch(restoreBlock, /preferences\.coachOpenEnded/);
});
