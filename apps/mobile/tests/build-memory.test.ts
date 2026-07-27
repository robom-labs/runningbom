// Android 빌드 메모리 설정이 실제로 gradle.properties에 들어가는지 검증합니다.
// 이 값이 빠지면 expo-updates 코드 생성 단계에서 Metaspace가 터져 빌드가 통째로 멈춥니다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import appJson from '../app.json';
import easJson from '../eas.json';

type GradleProperty = { type: 'property'; key: string; value: string };
type GradleEntry = GradleProperty | { type: 'comment'; value: string };

const require = createRequire(import.meta.url);
const {
  MEMORY_PROPERTIES,
  upsert,
}: {
  MEMORY_PROPERTIES: GradleProperty[];
  upsert: (properties: GradleEntry[], property: GradleProperty) => GradleEntry[];
} = require('../plugins/withBuildMemory.js');

function apply(initial: GradleEntry[]): GradleEntry[] {
  return MEMORY_PROPERTIES.reduce(upsert, initial);
}

function valueOf(properties: GradleEntry[], key: string): string | undefined {
  const found = properties.find(
    (entry): entry is GradleProperty => entry.type === 'property' && entry.key === key,
  );
  return found?.value;
}

/** `-XX:MaxMetaspaceSize=2048m` 같은 표기에서 MB 숫자만 꺼냅니다. */
function metaspaceMb(jvmargs: string | undefined): number {
  const match = /-XX:MaxMetaspaceSize=(\d+)([mg])/i.exec(jvmargs ?? '');
  assert.ok(match, `MaxMetaspaceSize를 찾지 못했습니다: ${jvmargs}`);
  const amount = Number.parseInt(match[1], 10);
  return match[2].toLowerCase() === 'g' ? amount * 1024 : amount;
}

describe('Android 빌드 메모리', () => {
  it('Expo 기본값(512m)을 덮어써서 Metaspace를 넉넉하게 올린다', () => {
    // Expo가 만들어 주는 기본 gradle.properties와 같은 모양입니다.
    const expoDefault: GradleEntry[] = [
      { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m' },
      { type: 'property', key: 'android.useAndroidX', value: 'true' },
    ];

    const result = apply(expoDefault);

    assert.ok(metaspaceMb(valueOf(result, 'org.gradle.jvmargs')) >= 2048);
    // 관계없는 설정은 그대로 남아 있어야 합니다.
    assert.equal(valueOf(result, 'android.useAndroidX'), 'true');
    // 같은 key가 두 번 생기면 나중 값이 이겨서 헷갈리므로, 하나만 있어야 합니다.
    const jvmargsCount = result.filter(
      (entry) => entry.type === 'property' && entry.key === 'org.gradle.jvmargs',
    ).length;
    assert.equal(jvmargsCount, 1);
  });

  it('Kotlin/KSP 데몬에도 따로 메모리를 준다', () => {
    // Kotlin 데몬은 Gradle 데몬 설정을 물려받지 않아, 이 값이 없으면 여기서 터집니다.
    const result = apply([]);

    assert.ok(metaspaceMb(valueOf(result, 'kotlin.daemon.jvmargs')) >= 1024);
  });

  it('설정이 비어 있어도 필요한 값을 새로 만들어 넣는다', () => {
    const result = apply([]);

    for (const property of MEMORY_PROPERTIES) {
      assert.equal(valueOf(result, property.key), property.value);
    }
  });

  it('앱 설정에 이 플러그인이 실제로 연결돼 있다', () => {
    // 플러그인을 만들어 놓고 등록을 잊으면 아무 일도 일어나지 않습니다.
    assert.ok(appJson.expo.plugins.includes('./plugins/withBuildMemory'));
  });

  it('빌드 설정 어디에도 오류 이름을 닮은 글자를 두지 않는다', () => {
    // CI가 빌드 로그에서 `java.lang.OutOfMemoryError`를 보면 즉시 빌드를 끊습니다.
    // 그런데 빌드 도구가 설정을 로그에 그대로 찍기 때문에, 설정값 안에 비슷한 글자가
    // 있으면 멀쩡한 빌드가 잘못 끊깁니다(실제로 35초 만에 끊긴 적이 있습니다).
    const settings = [
      ...MEMORY_PROPERTIES.map((property) => property.value),
      JSON.stringify(easJson),
    ];

    for (const setting of settings) {
      assert.ok(
        !setting.includes('OutOfMemoryError'),
        `빌드 설정에 'OutOfMemoryError'가 들어 있습니다: ${setting}`,
      );
    }
  });
});
