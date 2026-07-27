// Android 빌드에 쓰는 메모리를 넉넉하게 잡아 둡니다.
//
// Expo가 만들어 주는 android/gradle.properties의 기본값은
// `-Xmx2048m -XX:MaxMetaspaceSize=512m`입니다.
// 이 512m 때문에 expo-updates의 코드 생성 단계(kspReleaseKotlin)에서
// `java.lang.OutOfMemoryError: Metaspace`가 나면서 빌드가 통째로 멈췄습니다.
//
// 주의: 워크플로의 GRADLE_OPTS 환경값은 Gradle을 "시작하는" 쪽에만 걸리고,
// 실제로 컴파일하는 Gradle 데몬은 여기 gradle.properties 값을 씁니다.
// 그래서 이 파일이 실제로 효과가 있는 자리입니다.
const { withGradleProperties } = require('@expo/config-plugins');

/** 빌드를 도는 JVM들에게 줄 메모리입니다. GitHub 러너(메모리 16GB) 기준으로 잡았습니다. */
const MEMORY_PROPERTIES = [
  // Gradle 데몬 본체. 힙 4GB, Metaspace 2GB(기본값의 4배).
  {
    key: 'org.gradle.jvmargs',
    value: '-Xmx4096m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  },
  // Kotlin/KSP는 별도 데몬에서 돌아 Gradle 값을 물려받지 않으므로 따로 줍니다.
  {
    key: 'kotlin.daemon.jvmargs',
    value: '-Xmx3072m -XX:MaxMetaspaceSize=1024m',
  },
];

/** 이미 같은 key가 있으면 값을 덮어쓰고, 없으면 뒤에 추가합니다. */
function upsert(properties, { key, value }) {
  const existing = properties.find((entry) => entry.type === 'property' && entry.key === key);
  if (existing) {
    existing.value = value;
    return properties;
  }
  return [...properties, { type: 'property', key, value }];
}

module.exports = function withBuildMemory(config) {
  return withGradleProperties(config, (gradleConfig) => {
    gradleConfig.modResults = MEMORY_PROPERTIES.reduce(upsert, gradleConfig.modResults);
    return gradleConfig;
  });
};

module.exports.MEMORY_PROPERTIES = MEMORY_PROPERTIES;
module.exports.upsert = upsert;
