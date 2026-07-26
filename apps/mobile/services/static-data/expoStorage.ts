// Expo 문서 디렉터리에 임시 파일을 쓴 뒤 원자적으로 교체하는 LKG 저장소입니다.
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import type { StaticDataTextStorage } from './types';

function safeSegments(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..' || !/^[a-zA-Z0-9._-]+$/.test(segment))
  ) {
    throw new Error('unsafe static data storage path');
  }
  return segments;
}

export class ExpoStaticDataStorage implements StaticDataTextStorage {
  private readonly root = new Directory(Paths.document, 'runningbom-static-data');

  async readText(path: string): Promise<string | null> {
    const file = new File(this.root, ...safeSegments(path));
    return file.exists ? file.text() : null;
  }

  async replaceAtomically(path: string, text: string): Promise<void> {
    const segments = safeSegments(path);
    const fileName = segments.at(-1);
    if (!fileName) throw new Error('static data file name missing');
    const parent = new Directory(this.root, ...segments.slice(0, -1));
    parent.create({ idempotent: true, intermediates: true });
    const destination = new File(parent, fileName);
    const temporary = new File(parent, `.${fileName}.${randomUUID()}.tmp`);
    try {
      temporary.create({ intermediates: true, overwrite: true });
      temporary.write(text);
      await temporary.move(destination, { overwrite: true });
    } catch (error) {
      if (temporary.exists) temporary.delete();
      throw error;
    }
  }
}
