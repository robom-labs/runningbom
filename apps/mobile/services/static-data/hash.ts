// UTF-8 정적 데이터의 SHA-256을 기기 네이티브 crypto로 계산합니다.
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from 'expo-crypto';

export async function sha256Utf8(text: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, text, {
    encoding: CryptoEncoding.HEX,
  });
}
