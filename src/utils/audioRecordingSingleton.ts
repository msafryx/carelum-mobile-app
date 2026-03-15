/**
 * Single global reference to the active expo-av Recording.
 * expo-av allows only one Recording to be prepared at a time; this ensures we
 * stop any existing recording before creating a new one (e.g. when both
 * session page and CryDetectionInterface can start recording).
 */

type RecordingLike = {
  stopAndUnloadAsync: () => Promise<unknown>;
};

let currentRecording: RecordingLike | null = null;

export function getCurrentRecording(): RecordingLike | null {
  return currentRecording;
}

export function setCurrentRecording(recording: RecordingLike | null): void {
  currentRecording = recording;
}

/**
 * Stop and unload the current recording if any. Call this before
 * Recording.createAsync() to avoid "Only one Recording object can be prepared at a given time".
 */
export async function stopCurrentRecordingIfAny(): Promise<void> {
  if (currentRecording) {
    try {
      await currentRecording.stopAndUnloadAsync();
    } catch (_) {
      // ignore
    }
    currentRecording = null;
  }
}
