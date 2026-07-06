"use client";

import ProductImageFrame from "@/components/ProductImageFrame";
import {
  uploadImageToStorage,
  type UploadedImage,
} from "@/lib/firebase-services/storage";
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

const labelClass = "text-xs font-black uppercase tracking-wide text-slate-500";

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
      const message =
        error instanceof Error ? error.message : "No se pudo subir la imagen.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className={labelClass}>{label}</span>

      <div className="overflow-hidden rounded-2xl border border-rose-100 bg-[#fffaf5]">
        {value ? (
          <div className={`relative ${previewClassName}`}>
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
              className="absolute bottom-3 right-3 inline-flex items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-rose-600 shadow-sm transition hover:bg-rose-50"
            >
              <Trash2 size={14} />
              Quitar
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 px-4 py-6 text-center transition hover:bg-rose-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm ring-1 ring-rose-100">
              {isUploading ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                <ImagePlus size={22} />
              )}
            </span>
            <span className="text-sm font-black text-slate-800">
              {isUploading ? "Subiendo imagen..." : "Subir imagen"}
            </span>
            <span className="max-w-xs text-xs font-semibold leading-5 text-slate-400">
              {helperText ?? "JPG, PNG o WebP. Se optimiza automáticamente para que pese menos y cargue rápido."}
            </span>
          </label>
        )}
      </div>

      {value && (
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
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
      const message =
        error instanceof Error ? error.message : "No se pudieron subir las imágenes.";
      toast.error(message);
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
    <div className="space-y-2">
      <span className={labelClass}>{label}</span>

      <div className="rounded-2xl border border-rose-100 bg-[#fffaf5] p-3">
        {cleanValues.length > 0 && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cleanValues.map((url, index) => (
              <div
                key={url}
                className="overflow-hidden rounded-2xl bg-white ring-1 ring-rose-100"
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
                <div className="space-y-2 p-3">
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
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-200 bg-white px-4 py-5 text-center transition hover:bg-rose-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            {isUploading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <UploadCloud size={20} />
            )}
          </span>
          <span className="text-sm font-black text-slate-800">
            {isUploading ? "Subiendo..." : "Subir una o varias imágenes"}
          </span>
          <span className="max-w-md text-xs font-semibold leading-5 text-slate-400">
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
