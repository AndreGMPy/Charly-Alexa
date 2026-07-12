import type { LocalProduct, ProductVariant, SaleItemDraft } from "../domain/models";

export function buildWholesaleRun(product: LocalProduct, color: string, variants: ProductVariant[]): SaleItemDraft[] {
  if (!product.wholesaleRunEnabled || !product.wholesaleRunPrice) {
    throw new Error("Este producto no tiene mayoreo corrido configurado.");
  }
  if (product.wholesaleRunSizes.length === 0) {
    throw new Error("La corrida no tiene tallas configuradas.");
  }
  return product.wholesaleRunSizes.map((size) => {
    const variant = variants.find((item) => item.productId === product.id && item.color === color && item.size === size);
    if (!variant || variant.stock < 1) {
      throw new Error(`No hay stock para completar la corrida: ${color}, talla ${size}.`);
    }
    return { product, color, size, quantity: 1, unitPrice: product.wholesaleRunPrice!, appliedWholesale: true };
  });
}
