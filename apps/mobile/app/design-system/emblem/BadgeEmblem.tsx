// 배지 엠블럼을 코드로 그립니다. 이미지 파일도, 이모지도 쓰지 않습니다.
// 규칙: (1) 바깥은 원 또는 방패, (2) 그 안에 분류별 기하 도형 하나,
//       (3) 등급만큼 얇은 링을 더합니다. 실사 메달을 흉내 내지 않습니다.
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { BadgeCategory, BadgeTier } from '../../../domains/badges/rules';
import {
  emblemViewBox,
  progressArcColor,
  skinFor,
  type EmblemState,
} from './tokens';

/** 방패를 쓰는 분류입니다. 밖에서 얻는 배지(대회·함께)만 방패이고 나머지는 원입니다. */
const shieldCategories = new Set<BadgeCategory>(['race', 'community']);

const SHIELD_PATH =
  'M50 6 L88 20 V50 C88 71 72 85 50 94 C28 85 12 71 12 50 V20 Z';

const OUTER_RADIUS = 44;
const RING_GAP = 5.5;

type GlyphProps = {
  color: string;
};

/** 분류마다 안쪽 도형 하나씩. 모두 100x100 좌표계의 가운데 지름 44 안에 들어옵니다. */
function CategoryGlyph({ category, color }: GlyphProps & { category: BadgeCategory }) {
  switch (category) {
    // 첫 경험: 출발점. 가운데 점과 그것을 감싸는 얇은 원.
    case 'first':
      return (
        <G>
          <Circle cx={50} cy={50} r={16} stroke={color} strokeWidth={2.4} fill="none" />
          <Circle cx={50} cy={50} r={6.5} fill={color} />
        </G>
      );
    // 연속 기록: 끊기지 않고 이어지는 세로 획 셋.
    case 'streak':
      return (
        <G>
          <Rect x={35} y={36} width={5.5} height={28} rx={2.75} fill={color} />
          <Rect x={47.25} y={31} width={5.5} height={38} rx={2.75} fill={color} />
          <Rect x={59.5} y={36} width={5.5} height={28} rx={2.75} fill={color} />
        </G>
      );
    // 꾸준함: 규칙적으로 찍히는 점 아홉.
    case 'consistency':
      return (
        <G>
          {[36, 50, 64].map((y) =>
            [36, 50, 64].map((x) => (
              <Circle cx={x} cy={y} key={`${x}-${y}`} r={3.4} fill={color} />
            )),
          )}
        </G>
      );
    // 거리: 앞으로 나아가는 평행한 사선 셋.
    case 'distance':
      return (
        <G>
          <Path d="M32 62 L52 38" stroke={color} strokeWidth={4.4} strokeLinecap="round" />
          <Path d="M44 62 L64 38" stroke={color} strokeWidth={4.4} strokeLinecap="round" />
          <Path d="M56 62 L70 45" stroke={color} strokeWidth={4.4} strokeLinecap="round" />
        </G>
      );
    // 시간: 시계 바늘 둘.
    case 'duration':
      return (
        <G>
          <Circle cx={50} cy={50} r={17} stroke={color} strokeWidth={2.4} fill="none" />
          <Path d="M50 50 V37" stroke={color} strokeWidth={4} strokeLinecap="round" />
          <Path d="M50 50 H61" stroke={color} strokeWidth={4} strokeLinecap="round" />
        </G>
      );
    // 시간대: 지평선 위로 반쯤 오른 해.
    case 'timeOfDay':
      return (
        <G>
          <Path d="M34 58 A16 16 0 0 1 66 58 Z" fill={color} />
          <Rect x={28} y={62} width={44} height={4} rx={2} fill={color} />
          <Path d="M50 26 V32" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M28 36 L32 40" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M72 36 L68 40" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
        </G>
      );
    // 회복: 잎 하나와 잎맥.
    case 'recovery':
      return (
        <G>
          <Path
            d="M50 30 C64 40 64 60 50 70 C36 60 36 40 50 30 Z"
            fill={color}
            opacity={0.9}
          />
          <Path d="M50 32 V68" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </G>
      );
    // 대회: 결승 깃발.
    case 'race':
      return (
        <G>
          <Rect x={36} y={30} width={4.5} height={40} rx={2.25} fill={color} />
          <Path d="M42 32 L66 40 L42 48 Z" fill={color} />
        </G>
      );
    // 함께: 나란히 선 세 사람.
    case 'community':
      return (
        <G>
          <Circle cx={50} cy={38} r={8} fill={color} />
          <Circle cx={33} cy={54} r={6.5} fill={color} opacity={0.75} />
          <Circle cx={67} cy={54} r={6.5} fill={color} opacity={0.75} />
        </G>
      );
    default:
      return <Circle cx={50} cy={50} r={12} fill={color} />;
  }
}

export type BadgeEmblemProps = {
  category: BadgeCategory;
  tier: BadgeTier;
  state: EmblemState;
  size?: number;
  /** 진행 중일 때 테두리를 따라 차오르는 비율입니다(0~1). */
  ratio?: number;
  style?: StyleProp<ViewStyle>;
};

export const BadgeEmblem = memo(function BadgeEmblem({
  category,
  tier,
  state,
  size = 64,
  ratio = 0,
  style,
}: BadgeEmblemProps) {
  const skin = skinFor(tier, state);
  const shield = shieldCategories.has(category);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const arcRadius = OUTER_RADIUS + 2.5;
  const circumference = 2 * Math.PI * arcRadius;
  const showArc = state === 'progress' && clamped > 0;

  // 링은 등급만큼 안쪽으로 하나씩 더 그립니다. 안쪽 링일수록 얇아집니다.
  const ringRadii = Array.from({ length: skin.rings }, (_, index) => ({
    r: OUTER_RADIUS - index * RING_GAP,
    width: skin.ringWidth * (index === 0 ? 1 : 0.55),
  }));

  return (
    <View pointerEvents="none" style={style}>
      <Svg height={size} viewBox={`0 0 ${emblemViewBox} ${emblemViewBox}`} width={size}>
        {shield ? (
          <Path d={SHIELD_PATH} fill={skin.field} stroke={skin.ring} strokeWidth={skin.ringWidth} />
        ) : (
          <Circle
            cx={50}
            cy={50}
            fill={skin.field}
            r={OUTER_RADIUS}
            stroke={skin.ring}
            strokeWidth={skin.ringWidth}
          />
        )}
        {!shield
          ? ringRadii.slice(1).map((ring) => (
              <Circle
                cx={50}
                cy={50}
                fill="none"
                key={ring.r}
                opacity={0.8}
                r={ring.r}
                stroke={skin.ring}
                strokeWidth={ring.width}
              />
            ))
          : null}
        {showArc ? (
          <Circle
            cx={50}
            cy={50}
            fill="none"
            r={arcRadius}
            stroke={progressArcColor}
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            strokeLinecap="round"
            strokeWidth={3}
            transform="rotate(-90 50 50)"
          />
        ) : null}
        <G opacity={state === 'locked' ? 0.45 : 1}>
          <CategoryGlyph category={category} color={skin.glyph} />
        </G>
      </Svg>
    </View>
  );
});
