/* eslint-disable @next/next/no-img-element */

type ProductImageFrameProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export default function ProductImageFrame({
  src,
  alt,
  className = "",
  imageClassName = "",
  priority = false,
}: ProductImageFrameProps) {
  return (
    <div className={`overflow-hidden bg-[#fffaf5] ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className={`h-full w-full object-contain p-2 ${imageClassName}`}
      />
    </div>
  );
}
