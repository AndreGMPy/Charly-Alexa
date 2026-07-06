import { storage, isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

export type UploadedImage = {
  path: string;
  url: string;
  originalSize: number;
  uploadedSize: number;
};

const MAX_ORIGINAL_IMAGE_SIZE_MB = 18;
const MAX_ORIGINAL_IMAGE_SIZE_BYTES = MAX_ORIGINAL_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_UPLOAD_WIDTH = 1600;
const MAX_UPLOAD_HEIGHT = 1600;
const IMAGE_QUALITY = 0.82;

function ensureStorageConfigured() {
  if (!isFirebaseConfigured || !storage) {
    throw new Error("El almacenamiento no está configurado.");
  }

  return storage;
}

function sanitizeSegment(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/(^-|-$)/g, "") || "archivo"
  );
}

function getFileExtension(file: File) {
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";

  const fileNameExtension = file.name.split(".").pop()?.toLowerCase();
  return fileNameExtension || "webp";
}

function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo puedes subir archivos de imagen.");
  }

  if (file.size > MAX_ORIGINAL_IMAGE_SIZE_BYTES) {
    throw new Error(
      `La imagen original debe pesar menos de ${MAX_ORIGINAL_IMAGE_SIZE_MB} MB.`
    );
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function optimizeImageFile(file: File) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  validateImageFile(file);

  const image = await loadImage(file);
  const ratio = Math.min(
    1,
    MAX_UPLOAD_WIDTH / image.width,
    MAX_UPLOAD_HEIGHT / image.height
  );
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const webpBlob = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY);
  const fallbackBlob =
    webpBlob ?? (await canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY));

  if (!fallbackBlob) return file;

  const optimizedType = webpBlob ? "image/webp" : "image/jpeg";
  const optimizedExtension = webpBlob ? "webp" : "jpg";
  const cleanName = file.name.replace(/\.[^/.]+$/, "");

  return new File([fallbackBlob], `${cleanName}.${optimizedExtension}`, {
    type: optimizedType,
    lastModified: Date.now(),
  });
}

export async function uploadImageToStorage(
  file: File,
  folder: string
): Promise<UploadedImage> {
  const storageInstance = ensureStorageConfigured();
  validateImageFile(file);

  const optimizedFile = await optimizeImageFile(file);
  const cleanFolder = folder
    .split("/")
    .map(sanitizeSegment)
    .filter(Boolean)
    .join("/");
  const cleanName = sanitizeSegment(optimizedFile.name.replace(/\.[^/.]+$/, ""));
  const extension = getFileExtension(optimizedFile);
  const path = `${cleanFolder}/${Date.now()}-${cleanName}.${extension}`;
  const imageRef = ref(storageInstance, path);

  await uploadBytes(imageRef, optimizedFile, {
    contentType: optimizedFile.type,
    customMetadata: {
      optimized: "true",
      originalSize: String(file.size),
      uploadedSize: String(optimizedFile.size),
    },
  });

  return {
    path,
    url: await getDownloadURL(imageRef),
    originalSize: file.size,
    uploadedSize: optimizedFile.size,
  };
}

export async function uploadProductImage(file: File, productId: string) {
  return uploadImageToStorage(file, `products/${productId}`);
}

export async function uploadHomepageImage(file: File, slot: string) {
  return uploadImageToStorage(file, `homepage/${slot}`);
}

export async function uploadCategoryImage(file: File, categoryId: string) {
  return uploadImageToStorage(file, `categories/${categoryId}`);
}

export async function uploadSiteImage(file: File, slot: string) {
  return uploadImageToStorage(file, `site/${slot}`);
}

export async function deleteImageByPath(path: string) {
  const storageInstance = ensureStorageConfigured();
  await deleteObject(ref(storageInstance, path));
}

export async function deleteProductImage(path: string) {
  await deleteImageByPath(path);
}
