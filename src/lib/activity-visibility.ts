export function activityVisible({ visible, intersecting, height, visibleHeight }: {
  visible: boolean; intersecting: boolean; height: number; visibleHeight: number;
}) {
  return visible && intersecting && height > 0 && visibleHeight > 0 && visibleHeight >= Math.min(100, height / 2);
}
