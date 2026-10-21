"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { photoSelectionProblem } from "@/lib/form-ux";

function LocalPhoto({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    if (image.current) image.current.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted text-center text-xs">
    {/* Local file preview; no network image optimisation. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={image} alt="Selected photo preview" className={failed ? "hidden" : "size-full object-cover"} onLoad={() => setFailed(false)} onError={() => setFailed(true)} />
    {failed && <span>Preview unavailable</span>}
  </div>;
}

export function PhotoSelection({ files, onChange, onError, limit, busy, compact = false }: {
  files: File[]; onChange: (files: File[]) => void; onError: (error: string) => void; limit: number; busy: boolean; compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return <div className={compact ? "contents" : "space-y-2"}>
    {compact ? <IconButton label="Attach photos" icon={<Paperclip aria-hidden />} disabled={busy} onClick={() => input.current?.click()} /> :
      <><p className="text-sm font-medium">Photos (optional)</p><Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>Choose photos</Button></>}
    <input id={id} ref={input} type="file" className="hidden" tabIndex={-1} aria-label="Choose photos" disabled={busy} multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event => {
      if (busy) return;
      const next = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!next.length) return;
      const error = photoSelectionProblem(next, limit);
      onError(error);
      if (!error) onChange(next);
    }} />
    {!compact && <p className="text-xs text-muted-foreground">Up to {limit} photos, 10 MB each. JPEG, PNG, WebP or HEIC. Choosing again replaces this selection.</p>}
    {files.length > 0 && <ul aria-label="Selected photos" className={compact ? "order-first flex w-full flex-wrap gap-3" : "flex flex-wrap gap-3"}>
      {files.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`} className="w-28 space-y-1">
        <LocalPhoto file={file} /><p className="truncate text-xs" title={file.name}>{file.name}</p>
        <button type="button" disabled={busy} className="min-h-11 text-sm text-link underline" aria-label={`Remove selected photo ${index + 1}: ${file.name}`} onClick={() => { onChange(files.filter((_, position) => position !== index)); onError(""); }}>Remove</button>
      </li>)}
      <li className="w-full text-xs text-muted-foreground">{busy ? "Sending selected photos…" : "Selected locally · not sent yet."}{compact ? ` Up to ${limit} photos, 10 MB each.${busy ? "" : " Choosing again replaces the selection."}` : ""}</li>
    </ul>}
  </div>;
}
