/**
 * Read a local file URI (file:// or content://) into a Blob.
 * Uses expo-file-system to avoid React Native fetch() issues with local URIs
 * (e.g. "Network request failed" when using fetch(uri) on Android).
 */
import * as FileSystem from 'expo-file-system';

const AUDIO_EXT = ['.m4a', '.wav', '.aac', '.mp4'];

/** Find most recently modified audio file in cache (fallback when getURI not available). */
export async function findMostRecentRecordingUri(maxAgeMs: number = 15000): Promise<string | null> {
  try {
    const cache = FileSystem.cacheDirectory;
    if (!cache) return null;
    const cutoff = Date.now() - maxAgeMs;
    let best: { uri: string; mtime: number } | null = null;

    const scanDir = async (dir: string): Promise<void> => {
      try {
        const names = await FileSystem.readDirectoryAsync(dir);
        for (const name of names) {
          const path = dir.endsWith('/') ? dir + name : dir + '/' + name;
          try {
            const info = await FileSystem.getInfoAsync(path, { size: false });
            if (!info.exists) continue;
            const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : '';
            if (info.isDirectory) {
              await scanDir(path);
            } else if (AUDIO_EXT.includes(ext)) {
              const mtime = (info as any).modificationTime
                ? (info as any).modificationTime * 1000
                : Date.now();
              if (mtime >= cutoff && (!best || mtime > best.mtime)) {
                best = { uri: path.startsWith('file://') ? path : 'file://' + path, mtime };
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    };

    await scanDir(cache);
    return best?.uri ?? null;
  } catch (_) {
    return null;
  }
}

export async function readFileUriToBlob(
  uri: string,
  mimeType: string = 'audio/wav'
): Promise<Blob> {
  if (uri == null || typeof uri !== 'string' || !uri) {
    throw new Error('readFileUriToBlob: uri is required');
  }
  if (!uri.startsWith('file://') && !uri.startsWith('content://') && uri.startsWith('/')) {
    uri = 'file://' + uri;
  }
  const isLocal = uri.startsWith('file://') || uri.startsWith('content://');
  if (isLocal) {
    let pathToRead = uri;
    let tempPath: string | null = null;
    if (uri.startsWith('content://')) {
      const cache = FileSystem.cacheDirectory;
      if (!cache) throw new Error('No cache directory');
      tempPath = cache + `audio_temp_${Date.now()}.wav`;
      await FileSystem.copyAsync({ from: uri, to: tempPath });
      pathToRead = tempPath;
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(pathToRead, {
        encoding: 'base64',
      });
      if (tempPath) {
        try {
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        } catch (_) {}
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } catch (e) {
      if (tempPath) {
        try {
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        } catch (_) {}
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg || 'Could not read audio file');
    }
  }
  const response = await fetch(uri);
  return response.blob();
}
