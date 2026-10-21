"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { PictureAvatar } from "@/components/picture-avatar";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { PictureKind, PictureState } from "@/lib/supabase/pictures";
import { useTransientMessage } from "@/components/form-feedback";

type Upload = { file: File; intentId: string; path: string; uploaded: boolean; assetId?: string };

export function PictureSettings({ kind, targetId, name, picture }: {
  kind: PictureKind; targetId: string; name: string; picture: PictureState;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useTransientMessage<string>("");
  const [confirming, setConfirming] = useState(false);
  const inFlight = useRef(false);
  const prepared = useRef<Upload | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    if (inFlight.current) return;
    const next = event.target.files?.[0] ?? null;
    setError(""); setMessage("");
    if (next && (next.size === 0 || next.size > 10_000_000)) {
      setError("Choose a photo smaller than 10 MB.");
      prepared.current = null; setFile(null); setPreview(null);
      event.target.value = "";
      return;
    }
    prepared.current = null;
    setFile(next); setPreview(next ? URL.createObjectURL(next) : null);
  }

  async function save(remove = false) {
    if (inFlight.current || (!remove && !file)) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const client = createClient();
      let assetId: string | null = null;
      if (!remove && file) {
        if (!prepared.current || prepared.current.file !== file) {
          const requested = await client.rpc("request_plate_upload");
          if (requested.error) throw requested.error;
          const intent = requested.data?.[0];
          if (!intent) throw new Error("Couldn’t prepare your photo.");
          prepared.current = { file, intentId: intent.intent_id, path: intent.staged_path, uploaded: false };
        }
        const upload = prepared.current;
        if (!upload.uploaded) {
          const stored = await client.storage.from("staged-assets").upload(upload.path, file, { upsert: false, contentType: "application/octet-stream" });
          // An interrupted response can leave a completed object. Never overwrite it.
          if (stored.error && String(stored.error.statusCode) !== "409") throw stored.error;
          upload.uploaded = true;
        }
        for (let attempt = 0; !upload.assetId && attempt < 60; attempt++) {
          const state = await client.from("media_upload_intents").select("state,asset_id").eq("id", upload.intentId).single();
          if (state.error) throw state.error;
          if (state.data.state === "failed") throw new Error("Couldn’t process this photo. Choose another and try again.");
          if (state.data.state === "ready") { upload.assetId = state.data.asset_id; break; }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!upload.assetId) throw new Error("Your photo is still processing. Wait a moment, then try again.");
        assetId = upload.assetId;
      }
      const result = await client.rpc("set_picture", { p_kind: kind, p_target_id: targetId, p_asset_id: assetId, p_expected_version: picture.version });
      if (result.error) throw result.error;
      prepared.current = null; setFile(null); setPreview(null); setConfirming(false);
      if (field.current) field.current.value = "";
      setMessage(remove ? "Photo removed." : "Photo saved.");
      if (kind === "profile") window.dispatchEvent(new Event("plates:profile-changed"));
      router.refresh();
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
      setError(code === "40001" ? "The photo changed elsewhere. Reload this page before trying again."
        : cause instanceof Error ? cause.message : "Couldn’t save your photo. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="mt-6 rounded-lg border bg-card p-6">
    <h2 className="font-display text-xl font-bold">{kind === "table" ? "Table photo" : "Profile photo"}</h2>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <PictureAvatar name={name} url={preview ?? picture.url} table={kind === "table"} className="size-20" />
      <div className="min-w-0 flex-1">
        <Button type="button" variant="outline" disabled={busy} onClick={() => field.current?.click()}>Choose a photo</Button>
        <input ref={field} type="file" className="hidden" tabIndex={-1} aria-label="Choose a photo" disabled={busy} onChange={choose} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" />
        {file && <p className="mt-2 break-all text-sm">{file.name}</p>}
        <p className="mt-2 text-meta text-muted-foreground">JPEG, PNG, WebP or HEIC, up to 10 MB. Profile and Table photos use a centred crop.</p>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-3">
      <Button disabled={busy || !file} onClick={() => void save()}>{busy ? "Saving…" : "Save photo"}</Button>
      {file && <Button variant="outline" disabled={busy} onClick={() => { setFile(null); setPreview(null); setError(""); setMessage(""); prepared.current = null; if (field.current) field.current.value = ""; }}>Cancel</Button>}
      {picture.assetId && <Button variant="link" className="text-destructive" disabled={busy} onClick={() => { setError(""); setConfirming(true); }}>Remove photo</Button>}
    </div>
    {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <AlertDialog open={confirming} onOpenChange={open => { if (!inFlight.current) { setConfirming(open); if (!open) setError(""); } }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {kind === "table" ? "Table" : "profile"} photo?</AlertDialogTitle>
        <AlertDialogDescription>Initials will appear instead. The old photo will be queued for removal.</AlertDialogDescription></AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void save(true)}>{busy ? "Removing…" : error ? "Try again" : "Remove photo"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
