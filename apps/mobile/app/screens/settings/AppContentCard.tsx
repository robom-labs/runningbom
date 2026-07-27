// 지금 폰에 무엇이 깔려 있는지 보여 주고, 원할 때 바로 새 내용을 받는 곳입니다.
//
// 이 화면이 없던 동안, "고쳤습니다"와 "안 되는데요" 사이에서 무엇이 문제인지
// 아무도 알 수 없었습니다. 고친 내용이 폰에 도달하지 않은 것인지,
// 도달했는데 틀린 것인지 구분할 방법이 없었기 때문입니다.
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';

import { Button, Card } from '../../design-system/components';
import { fontWeight, lineHeight, palette, spacing, typeScale } from '../../design-system/theme';
import {
  appContentStatus,
  checkForUpdateNow,
  updateOutcomeLabels,
} from '../../../services/updates/updateStatus';
import { isRunInProgress } from '../../../services/updates/runInProgress';

export function AppContentCard() {
  const [status, setStatus] = useState(() => appContentStatus());
  const [note, setNote] = useState<string | undefined>(undefined);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setNote('확인하는 중이에요…');
    const outcome = await checkForUpdateNow();
    setNote(updateOutcomeLabels[outcome.kind]);
    setStatus(appContentStatus());
    setChecking(false);

    if (outcome.kind !== 'downloaded') return;
    // 달리는 중에는 다시 시작하지 않습니다. 그날 기록이 통째로 사라집니다.
    if (isRunInProgress()) {
      setNote('새 내용을 받았어요. 지금은 달리는 중이라, 끝나고 나서 적용할게요.');
      return;
    }
    try {
      await Updates.reloadAsync();
    } catch {
      setNote('새 내용을 받았어요. 앱을 껐다 켜면 적용됩니다.');
    }
  }, []);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>지금 앱 내용</Text>
      <Text style={styles.body}>{status.label}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {status.enabled ? (
        <Button
          disabled={checking}
          label={checking ? '확인하는 중…' : '지금 업데이트 확인'}
          onPress={() => {
            void check();
          }}
          tone="secondary"
        />
      ) : null}
      <Text style={styles.hint}>
        새 내용은 앱을 열 때 저절로 받아 둡니다. 급할 때만 위 단추를 눌러 주세요.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  body: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
  },
  note: {
    color: palette.accentDark,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  hint: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
