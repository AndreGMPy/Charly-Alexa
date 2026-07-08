"use client";

import ProductImageFrame from "@/components/ProductImageFrame";
import {
  uploadImageToStorage,
  type UploadedImage,
} from "@/lib/firebase-services/storage";
import { getSafeUploadMessage, logErrorInDevelopment } from "@/lib/safe-errors";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useId, useState } from "react";
import { toast } from "sonner";

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  storagePath: string;
  helperText?: string;
  previewClassName?: string;
  previewFit?: "cover" | "contain";
};

type GalleryUploadFieldProps = {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
  storagePath: string;
  helperText?: string;
  previewFit?: "cover" | "contain";
};

const labelClass =
  "text-[10px] font-black uppercase tracking-wide text-slate-500 sm:text-xs";

function cleanGalleryUrls(urls: string[]) {
  return urls.map((url) => url.trim()).filter(Boolean);
}

async function uploadFiles(files: FileList, storagePath: string) {
  const uploadedImages: UploadedImage[] = [];

  for (const file of Array.from(files)) {
    uploadedImages.push(await uploadImageToStorage(file, storagePath));
  }

  return uploadedImages;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  storagePath,
  helperText,
  previewClassName = "h-44",
  previewFit = "cover",
}: ImageUploadFieldProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const isMainPhoto = label.toLowerCase().includes("principal");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setIsUploading(true);
      const uploaded = await uploadImageToStorage(file, storagePath);
      onChange(uploaded.url);
      toast.success("Imagen optimizada y subida", {
        description: `Antes ${(uploaded.originalSize / 1024 / 1024).toFixed(1)} MB · Ahora ${(uploaded.uploadedSize / 1024 / 1024).toFixed(1)} MB`,
      });
    } catch (error) {
      logErrorInDevelopment("Single image upload error", error);
      toast.error(getSafeUploadMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-1.5 sm:space-y-2">
      <span className={labelClass}>{label}</span>

      <div className="min-w-0 overflow-hidden rounded-xl border border-rose-100 bg-[#fffaf5] sm:rounded-2xl">
        {value ? (
          <div className={`relative min-w-0 ${previewClassName}`}>
            {previewFit === "contain" ? (
              <ProductImageFrame
                src={value}
                alt={label}
                className="absolute inset-0 rounded-none"
              />
            ) : (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${value})` }}
              />
            )}
            {previewFit === "cover" && (
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
            )}
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute bottom-2 right-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-black text-rose-600 shadow-sm transition hover:bg-rose-50 sm:bottom-3 sm:right-3"
            >
              <Trash2 size={14} />
              Quitar
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1.5 px-3 py-4 text-center transition hover:bg-rose-50 sm:min-h-40 sm:gap-2 sm:px-4 sm:py-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm ring-1 ring-rose-100 sm:h-12 sm:w-12 sm:rounded-2xl">
              {isUploading ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                <ImagePlus size={22} />
              )}
            </span>
            <span className="text-sm font-black text-slate-800">
              {isUploading
                ? "Subiendo..."
                : isMainPhoto
                  ? "Subir foto principal"
                  : "Subir imagen"}
            </span>
            <span className="max-w-xs text-[11px] font-semibold leading-4 text-slate-400 sm:text-xs sm:leading-5">
              {helperText ?? "JPG, PNG o WebP. Se optimiza automáticamente para que pese menos y cargue rápido."}
            </span>
          </label>
        )}
      </div>

      {value && (
        <label
          htmlFor={inputId}
          className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50 sm:px-4"
        >
          {isUploading ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
          Cambiar imagen
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
}

export function GalleryUploadField({
  label,
  values,
  onChange,
  storagePath,
  helperText,
  previewFit = "cover",
}: GalleryUploadFieldProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const cleanValues = cleanGalleryUrls(values);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";

    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const uploaded = await uploadFiles(files, storagePath);
      onChange([...cleanValues, ...uploaded.map((image) => image.url)]);
      toast.success(
        files.length === 1 ? "Imagen optimizada y agregada" : "Imágenes optimizadas y agregadas"
      );
    } catch (error) {
      logErrorInDevelopment("Gallery image upload error", error);
      toast.error(getSafeUploadMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  function removeImage(url: string) {
    onChange(cleanValues.filter((item) => item !== url));
  }

  function moveImage(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;

    if (nextIndex < 0 || nextIndex >= cleanValues.length) return;

    const nextValues = [...cleanValues];
    const [movedImage] = nextValues.splice(index, 1);
    nextValues.splice(nextIndex, 0, movedImage);
    onChange(nextValues);
    toast.success("Orden de fotos actualizado");
  }

  return (
    <div className="min-w-0 space-y-1.5 sm:space-y-2">
      <span className={labelClass}>{label}</span>

      <div className="min-w-0 rounded-xl border border-rose-100 bg-[#fffaf5] p-2 sm:rounded-2xl sm:p-3">
        {cleanValues.length > 0 && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cleanValues.map((url, index) => (
              <div
                key={url}
                className="min-w-0 overflow-hidden rounded-xl bg-white ring-1 ring-rose-100 sm:rounded-2xl"
              >
                {previewFit === "contain" ? (
                  <ProductImageFrame
                    src={url}
                    alt={`${label} ${index + 1}`}
                    className="h-28 rounded-none"
                  />
                ) : (
                  <div
                    className="h-28 bg-cover bg-center"
                    style={{ backgroundImage: `url(${url})` }}
                  />
                )}
                <div className="space-y-2 p-2.5 sm:p-3">
                  <div className="flex min-h-7 items-center justify-between gap-2">
                    {index === 0 ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase text-rose-600">
                        Foto principal
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        Foto extra
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => moveImage(index, "up")}
                      disabled={index === 0}
                      className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                      aria-label="Subir foto"
                    >
                      <ArrowUp size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveImage(index, "down")}
                      disabled={index === cleanValues.length - 1}
                      className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                      aria-label="Bajar foto"
                    >
                      <ArrowDown size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="inline-flex items-center justify-center rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100"
                      aria-label="Borrar foto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose-200 bg-white px-3 py-4 text-center transition hover:bg-rose-50 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500 ring-1 ring-rose-100 sm:h-11 sm:w-11 sm:rounded-2xl">
            {isUploading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <UploadCloud size={20} />
            )}
          </span>
          <span className="text-sm font-black text-slate-800">
            {isUploading ? "Subiendo..." : "Subir una o varias imágenes"}
          </span>
          <span className="max-w-md text-[11px] font-semibold leading-4 text-slate-400 sm:text-xs sm:leading-5">
            {helperText ?? "Puedes seleccionar varias fotos. Se reducen automáticamente antes de subir."}
          </span>
        </label>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
}
