import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const MAX_EDGE = 1600;
const MAX_BYTES = 4.8 * 1024 * 1024;

export class ImageFlowError extends Error {
  constructor(public readonly code: "cancelled" | "permission" | "processing") {
    super(code);
  }
}

export type UploadReadyImage = { uri: string; mimeType: "image/jpeg"; name: string };

const debug = (stage: string, data: Record<string, unknown>) => {
  if (__DEV__) console.info(`[Swipedia image] ${stage}`, data);
};

export async function pickCroppedImage(aspect: [number, number]): Promise<UploadReadyImage> {
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (permission.status !== "granted" && permission.canAskAgain) permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") throw new ImageFlowError("permission");

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: true, aspect });
  if (result.canceled || !result.assets[0]) throw new ImageFlowError("cancelled");
  const asset = result.assets[0];
  debug("crop-result", { uri: asset.uri, mimeType: asset.mimeType, width: asset.width, height: asset.height, fileSize: asset.fileSize });

  try {
    const largestSide = Math.max(asset.width ?? 0, asset.height ?? 0);
    const resize = largestSide > MAX_EDGE
      ? asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE }
      : undefined;
    let processed = await ImageManipulator.manipulateAsync(asset.uri, resize ? [{ resize }] : [], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
    let info = await FileSystem.getInfoAsync(processed.uri, { size: true });
    if (info.exists && (info.size ?? 0) > MAX_BYTES) {
      processed = await ImageManipulator.manipulateAsync(processed.uri, [{ resize: { width: 1200 } }], { compress: 0.68, format: ImageManipulator.SaveFormat.JPEG });
      info = await FileSystem.getInfoAsync(processed.uri, { size: true });
    }
    debug("normalized", { uri: processed.uri, exists: info.exists, size: info.exists ? info.size : 0, mimeType: "image/jpeg" });
    if (!info.exists || (info.size ?? 0) === 0 || (info.size ?? 0) > MAX_BYTES) throw new Error("invalid-output");
    return { uri: processed.uri, mimeType: "image/jpeg", name: `swipedia-${Date.now()}.jpg` };
  } catch (error) {
    if (__DEV__) console.warn("[Swipedia image] processing-failed", { uri: asset.uri, error: String(error) });
    throw new ImageFlowError("processing");
  }
}