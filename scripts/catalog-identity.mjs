// Model names must describe products, not accessibility text from an image gallery.
const galleryText = /(?:\bproduct\s+image\b|\bimage\s*\d+\s*of(?:\s*\d+)?\b|\bslide\s*\d+\s*of\s*\d+\b)/i;
const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase();

export function productVariantKey(product) {
 const sku = normalize(product.sku);
 return sku ? normalize(product.brand) + '|' + sku : '';
}

export function catalogIdentityIssue(product) {
 return [product.model, product.modelEn, product.name, product.color].some(value => galleryText.test(String(value || '')))
  ? 'image-gallery text is not a model or color' : null;
}

export function catalogIdentityProblems(products) {
 const issues = [], seen = new Map();
 for (const product of products) {
  const reason = catalogIdentityIssue(product);
  if (reason) issues.push({id:product.id, reason});
  const variant = productVariantKey(product);
  if (variant && seen.has(variant)) issues.push({id:product.id, reason:'duplicate brand/SKU', canonicalId:seen.get(variant)});
  else if (variant) seen.set(variant, product.id);
 }
 return issues;
}
