// 러닝화 옆모습을 그립니다.
//
// 사진이 아닙니다. 외부 이미지 0 · 번들 사진 0 · 브랜드 로고 0 · 월 고정비 0을 지키면서
// "목록이 글자만 있어서 조잡하다"를 없애는 방법입니다.
//
// 무엇을 그릴지는 `art.ts`의 `shoeArtSpec`이 정합니다(순수 함수, 테스트가 봅니다).
// 이 파일은 그 값을 좌표로 옮기기만 합니다.
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { palette } from '../../app/design-system/theme';
import type { ShoeArtSpec } from './art';

export type ShoeArtProps = {
  spec: ShoeArtSpec;
  /** 그림 폭입니다. 높이는 폭의 0.62배로 자동입니다(신발 비율). */
  width?: number;
  accessibilityLabel?: string;
};

const VIEW_W = 100;
const VIEW_H = 62;

export const ShoeArt = memo(function ShoeArt({
  accessibilityLabel,
  spec,
  width = 96,
}: ShoeArtProps) {
  const height = Math.round(width * (VIEW_H / VIEW_W));

  // 미드솔 두께: 6~18. 맥스 쿠션과 경량 트레이너가 눈으로 구분되어야 합니다.
  const midsoleH = 6 + spec.midsole * 12;
  // 앞코 들림: 0~9. 대회화가 확 들려 보여야 합니다.
  const lift = spec.toeSpring * 9;
  // 밑창 폭: 안정화가 넓게 깔립니다.
  const spread = spec.baseWidth * 4;

  const groundY = VIEW_H - 6;
  const midTop = groundY - midsoleH;
  const upperTop = midTop - (16 + (1 - spec.midsole) * 6);

  // 아웃솔 — 앞코가 들린 만큼 앞쪽이 위로 휩니다.
  const outsole = [
    `M ${8 - spread} ${groundY}`,
    `L ${86 + spread} ${groundY - lift * 0.45}`,
    `Q ${92 + spread} ${groundY - lift * 0.6} ${90 + spread} ${groundY - lift - 3}`,
    `L ${86 + spread} ${midTop + 1}`,
    `L ${8 - spread} ${midTop + 1}`,
    `Q ${4 - spread} ${midTop + 1} ${4 - spread} ${groundY - 3}`,
    'Z',
  ].join(' ');

  // 갑피 — 뒤꿈치는 세우고 앞은 낮게 눕힙니다.
  const upper = [
    `M 10 ${midTop}`,
    `L 10 ${upperTop + 4}`,
    `Q 12 ${upperTop} 20 ${upperTop}`,
    `L 44 ${upperTop + 1}`,
    `Q 62 ${upperTop + 3} 78 ${midTop - 4}`,
    `L 86 ${midTop - 1}`,
    `L 86 ${midTop}`,
    'Z',
  ].join(' ');

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      // 그림이 없어도 줄 높이가 흔들리지 않게 자리를 잡아 둡니다.
      style={{ width, height }}
    >
      <Svg height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={width}>
        {/* 바닥 그림자 — 신발이 떠 보이지 않게 합니다. */}
        <Ellipse
          cx={48}
          cy={groundY + 3}
          fill={palette.line}
          opacity={0.55}
          rx={44}
          ry={2.4}
        />

        <Path d={outsole} fill={spec.outsoleColor} />
        {/* 미드솔 — 아웃솔 위에 살짝 안쪽으로 얹습니다. */}
        <Path
          d={outsole}
          fill={spec.midsoleColor}
          transform={`translate(0 -2.5) scale(1 0.92) translate(0 ${groundY * 0.08})`}
        />

        {spec.plate !== 'none' ? (
          // 플레이트 — 미드솔 한가운데를 지나는 얇은 선 하나입니다.
          <Line
            stroke={spec.plate === 'carbon' ? palette.ink : palette.muted}
            strokeLinecap="round"
            strokeWidth={spec.plate === 'carbon' ? 2 : 1.2}
            x1={12}
            x2={84}
            y1={midTop + midsoleH * 0.55}
            y2={midTop + midsoleH * 0.4 - lift * 0.3}
          />
        ) : null}

        <Path d={upper} fill={spec.upperColor} />

        {/* 힐 카운터 — 뒤꿈치를 감싸는 조각. */}
        <Rect
          fill={spec.outsoleColor}
          height={upperTop ? midTop - upperTop - 4 : 8}
          opacity={0.35}
          rx={3}
          width={9}
          x={10}
          y={upperTop + 4}
        />

        {/* 끈 — 개수는 밑창 두께에 따라 4~5줄입니다. */}
        <G opacity={0.75}>
          {Array.from({ length: spec.laces }, (_, index) => {
            const x = 30 + index * 9;
            return (
              <Line
                key={x}
                stroke={palette.white}
                strokeLinecap="round"
                strokeWidth={1.6}
                x1={x}
                x2={x + 5}
                y1={upperTop + 4}
                y2={upperTop + 11}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
});
