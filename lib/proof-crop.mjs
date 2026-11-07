// Conservative starting crop for the supported transfer screenshot layouts.
// Keep manual controls: aspect ratio alone cannot identify every bank layout.
export function initialProofCrop(width, height) {
  const ratio = height / width;
  return {left:12, right:88, top:12, bottom:ratio >= 2 ? 39 : ratio >= 1.7 ? 40 : 45};
}
