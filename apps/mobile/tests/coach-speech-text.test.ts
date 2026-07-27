// 화면에 쓰는 글과 읽어 주는 글을 나누는 변환 규칙을 규칙마다 검증합니다.
// 여기서 지키는 약속: 원문은 절대 바뀌지 않고, 변환은 말하기 직전에만 일어납니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addBreathingPauses,
  expandAbbreviations,
  expandClockTimes,
  expandRanges,
  expandSymbols,
  expandUnits,
  longSentenceLength,
  tameExclamations,
  toSpeech,
  toSpeechLines,
  unwrapParentheses,
} from '../domains/coaching/speechText';

describe('읽어 줄 글 다듬기', () => {
  it('시계 표기를 분·초로 읽는다', () => {
    assert.equal(expandClockTimes('5:42'), '5분 42초');
    assert.equal(expandClockTimes('6:00'), '6분');
    assert.equal(expandClockTimes('5:05'), '5분 5초');
    assert.equal(expandClockTimes('1:05:30'), '1시간 5분 30초');
  });

  it('시계가 아닌 숫자는 건드리지 않는다', () => {
    assert.equal(expandClockTimes('20초 동안'), '20초 동안');
    assert.equal(expandClockTimes('3대 3 호흡'), '3대 3 호흡');
  });

  it('거리·속도 단위를 말로 바꾼다', () => {
    assert.equal(expandUnits('2.4km'), '2.4 킬로미터');
    assert.equal(expandUnits('1km를 지날 때마다'), '1 킬로미터를 지날 때마다');
    assert.equal(expandUnits('500m 앞'), '500 미터 앞');
    assert.equal(expandUnits('320kcal'), '320 킬로칼로리');
  });

  it('km/h 같은 표기를 그대로 읽지 않는다', () => {
    assert.equal(expandUnits('12km/h로 달려요'), '시속 12 킬로미터로 달려요');
    assert.equal(expandUnits('분/km 기준이에요'), '킬로미터당 기준이에요');
    assert.doesNotMatch(expandUnits('12km/h'), /km/i);
  });

  it('영어 약어를 한글 소리로 바꾼다', () => {
    assert.equal(expandAbbreviations('GPS 신호가 약해요'), '지피에스 신호가 약해요');
    assert.equal(expandAbbreviations('BPM 확인'), '분당 심박수 확인');
    assert.equal(expandAbbreviations('VO2max 향상'), '최대 산소 섭취량 향상');
    assert.equal(expandAbbreviations('D-3 남았어요'), '디데이 3일 전 남았어요');
  });

  it('5K, 10K를 킬로미터로 읽는다', () => {
    assert.equal(expandUnits('5K 도전'), '5킬로미터 도전');
    assert.equal(expandUnits('10K 기록'), '10킬로미터 기록');
  });

  it('한글 안에 섞인 영어 단어는 약어로 오해하지 않는다', () => {
    assert.equal(expandAbbreviations('OKAY'), 'OKAY');
    assert.equal(expandAbbreviations('SPBM'), 'SPBM');
  });

  it('괄호를 쉼표 문장으로 풀어 준다', () => {
    assert.equal(
      unwrapParentheses('짧고 빠르게(전력은 아니에요) 가요.'),
      '짧고 빠르게, 전력은 아니에요, 가요.',
    );
    assert.equal(unwrapParentheses('지금 페이스(  )'), '지금 페이스');
  });

  it('물결 범위를 "에서"로 읽는다', () => {
    assert.equal(expandRanges('5~6분'), '5에서 6분');
  });

  it('기호를 말로 풀거나 지운다', () => {
    assert.equal(expandSymbols('70%'), '70퍼센트');
    assert.equal(expandSymbols('자세 · 호흡'), '자세, 호흡');
    assert.match(expandSymbols('“좋아요”'), /^좋아요$/);
  });

  it('느낌표는 한 글에 하나만 남긴다', () => {
    assert.equal(tameExclamations('좋아요!!!'), '좋아요!');
    assert.equal(tameExclamations('좋아요! 최고! 대단!'), '좋아요! 최고. 대단.');
  });

  it('긴 문장에 숨 쉴 쉼표를 하나 만든다', () => {
    const long = '어깨가 올라와 있지 않은지 한번 확인하고 툭 내려 주세요.';
    assert.ok(long.length > longSentenceLength);
    assert.equal(addBreathingPauses(long), '어깨가 올라와 있지 않은지 한번 확인하고, 툭 내려 주세요.');
  });

  it('짧은 문장과 이미 쉼표가 있는 문장은 그대로 둔다', () => {
    assert.equal(addBreathingPauses('좋아요.'), '좋아요.');
    const already = '지금 페이스 좋아요, 어깨 힘 빼고 이대로 가요.';
    assert.equal(addBreathingPauses(already), already);
  });

  it('전체 변환을 한 번에 적용한다', () => {
    assert.equal(
      toSpeech('3km 지났어요. 평균 5:42, GPS 좋아요!!'),
      '3 킬로미터 지났어요. 평균 5분 42초, 지피에스 좋아요!',
    );
  });

  it('원문은 바뀌지 않는다', () => {
    const original = '2.4km · 5:42';
    const spoken = toSpeech(original);
    assert.equal(original, '2.4km · 5:42');
    assert.notEqual(spoken, original);
  });

  it('빈 글과 잘못된 값에도 안전하다', () => {
    assert.equal(toSpeech(''), '');
    assert.equal(toSpeech('   '), '');
    assert.equal(toSpeech(undefined as unknown as string), '');
    assert.deepEqual(toSpeechLines(['', '좋아요.']), ['좋아요.']);
  });

  it('한 번 바꾼 글을 다시 바꿔도 같은 결과가 나온다', () => {
    const once = toSpeech('12km/h로 5K를 달렸어요(기분 좋았어요).');
    assert.equal(toSpeech(once), once);
  });
});
