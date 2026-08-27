// Amazon's breadcrumb category is a deep, hierarchical string like
// "Electronics›Computers & Accessories›...›Mice". For filtering/display we
// only care about the broad top-level department, not the full path.
export function topLevelCategory(category: string | null): string | null {
  if (!category) return null;
  const [first] = category.split("›");
  return first?.trim() || null;
}
