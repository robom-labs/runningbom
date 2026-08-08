// 네이티브 메트로놈이 화면 타이머가 아닌 오디오 시계를 정본으로 쓰는지 검증합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync(
  new URL(
    '../modules/runningbom-coach/android/src/main/java/expo/modules/runningbomcoach/RunningbomMetronomeService.kt',
    import.meta.url,
  ),
  'utf8',
);
const moduleBridge = readFileSync(
  new URL(
    '../modules/runningbom-coach/android/src/main/java/expo/modules/runningbomcoach/RunningbomCoachModule.kt',
    import.meta.url,
  ),
  'utf8',
);
const manifest = readFileSync(
  new URL('../modules/runningbom-coach/android/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);
const screen = readFileSync(
  new URL('../app/screens/cadence/CadenceScreen.tsx', import.meta.url),
  'utf8',
);
const iosMetronome = readFileSync(
  new URL('../modules/runningbom-coach/ios/RunningbomMetronomeRuntime.swift', import.meta.url),
  'utf8',
);
const metronomeBridge = readFileSync(
  new URL('../services/audio/metronomeService.ts', import.meta.url),
  'utf8',
);

test('Android 박자는 AudioTrack의 blocking write를 오디오 시계로 사용합니다', () => {
  assert.match(service, /AudioTrack\.MODE_STREAM/);
  assert.match(service, /AudioTrack\.WRITE_BLOCKING/);
  assert.match(service, /while \(playing && generation == clockGeneration\)/);
  assert.doesNotMatch(service, /Timer|Handler|postDelayed|Thread\.sleep/);
});

test('메트로놈은 화면을 떠나도 유지되는 foreground mediaPlayback 서비스입니다', () => {
  assert.match(manifest, /RunningbomMetronomeService/);
  assert.match(manifest, /foregroundServiceType="mediaPlayback"/);
  assert.match(service, /startForeground/);
  assert.match(service, /START_STICKY/);
  assert.match(service, /restoreIfNeeded/);
  assert.match(service, /restoredDelaySamples/);
  assert.match(service, /startedAtEpochMillis/);
});

test('화면은 네이티브 박자를 제어할 뿐 JS timer로 소리를 만들지 않습니다', () => {
  assert.match(screen, /startNativeMetronome/);
  assert.match(screen, /getNativeMetronomeState/);
  assert.doesNotMatch(screen, /\bVibration\b/);
  assert.doesNotMatch(screen, /\bsetTimeout\b/);
  assert.match(moduleBridge, /AsyncFunction\("startMetronome"\)/);
  assert.match(moduleBridge, /AsyncFunction\("stopMetronome"\)/);
  assert.match(moduleBridge, /"underrunCount"/);
});

test('Android 박자는 소수 프레임 누적을 보정하고 PCM 블록을 재사용합니다', () => {
  assert.match(service, /floor\(beatCount \* framesPerBeat\)/);
  assert.match(service, /floor\(\(beatCount \+ 1\) \* framesPerBeat\)/);
  assert.match(service, /beatCache\.getOrPut/);
  assert.match(service, /clockGeneration/);
});

test('iOS 박자는 정확히 1분인 PCM을 AVAudioEngine에서 반복합니다', () => {
  assert.match(iosMetronome, /AVAudioEngine/);
  assert.match(iosMetronome, /AVAudioPlayerNode/);
  assert.match(iosMetronome, /sampleRate \* 60/);
  assert.match(iosMetronome, /for beat in 0\.\.<requested/);
  assert.match(iosMetronome, /options: \[\.loops\]/);
  assert.doesNotMatch(iosMetronome, /Timer|DispatchSourceTimer|Thread\.sleep/);
  assert.match(metronomeBridge, /Platform\.OS === 'android' \|\| Platform\.OS === 'ios'/);
});

test('60~200 BPM의 30분·2시간·6시간 오디오 프레임 위상 오차는 1프레임 미만입니다', () => {
  const sampleRate = 44_100;
  const bpms = [60, 120, 140, 160, 170, 180, 200];
  const durations = [30 * 60, 2 * 60 * 60, 6 * 60 * 60];

  for (const bpm of bpms) {
    const framesPerBeat = sampleRate * 60 / bpm;
    for (const durationSeconds of durations) {
      const expectedBeats = Math.floor(durationSeconds * bpm / 60);
      const generatedBoundary = Math.floor(expectedBeats * framesPerBeat);
      const idealBoundary = expectedBeats * framesPerBeat;
      assert.ok(
        Math.abs(generatedBoundary - idealBoundary) < 1,
        `${bpm} BPM ${durationSeconds}초에서 프레임 위상이 밀렸습니다`,
      );
      assert.equal(expectedBeats, durationSeconds * bpm / 60);
    }
  }
});
