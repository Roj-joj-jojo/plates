"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Heart, MessageCircle, Search, Users, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

const steps = [
  { label: "Feed", title: "A little inspiration, every day", icon: Utensils,
    body: "Your Feed brings together your Plates and the meals, recipes and places shared by people you follow.",
    note: "An empty Feed? Find a few people to follow, or share something of your own.",
    sampleTitle: "Sunday supper", sampleBody: "Roast tomatoes, warm bread and something good to share.", sampleMeta: "Alex · Meal" },
  { label: "Plates", title: "Share something worth keeping", icon: Heart,
    body: "A Plate can be a meal, a recipe or a place. Add words, links and photos. Like a Plate or open it to join the comments.",
    note: "Anyone signed in can see Plates from open accounts. Private accounts approve followers first. Comments share the Plate’s audience.",
    sampleTitle: "The pasta I keep coming back to", sampleBody: "Lemon, parmesan and a little pasta water. A weeknight favourite.", sampleMeta: "Sam · Recipe" },
  { label: "Tables", title: "Pull up a chair", icon: MessageCircle,
    body: "Tables are private conversations with the people you add. Share Plates, swap ideas, send photos or ask the Table a question when you need a recommendation.",
    note: "People you add join immediately and can read earlier conversation. Sharing a Plate doesn’t give Table members access to a private original. Save a question to Menu as a Request.",
    sampleTitle: "Friday dinner", sampleBody: "Any ideas for a place with good veggie options?", sampleMeta: "Your private Table · Question" },
  { label: "Menu", title: "Keep the good stuff close", icon: Bookmark,
    body: "Save Plates and Requests to your Menu so you can find them later. Remove a save when you no longer need it, or restore it from Removed items.",
    note: "Saved Plates keep a copy, even if the original changes. Requests open the discussion in their Table. Original comments stay separate, and you still need access to open originals or Table discussions. Deleting an account can remove its saved content too.",
    sampleTitle: "A recipe for next weekend", sampleBody: "Saved to your Menu, ready when you are.", sampleMeta: "Your saved Plate" },
  { label: "People", title: "Good food starts with good company", icon: Users,
    body: "Find people in Search, follow their Plates and manage followers and requests in People. The bell shows follows and comments on your Plates. The envelope shows Table activity, including mentions and replies.",
    note: "Open Account under your avatar to choose an open or private account. You can replay this introduction there too.",
    sampleTitle: "Find your people", sampleBody: "Search by name or username, then follow to bring their Plates into your Feed.", sampleMeta: "Search · People" },
];

export function Introduction() {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const step = steps[index];
  const Icon = step.icon;
  const last = index === steps.length - 1;

  function move(next: number) {
    setIndex(next);
    setError("");
    // Focus the new heading after React renders its text, without moving focus on refresh.
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function finish(destination = "/feed") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { error: saveError } = await createClient().rpc("complete_introduction");
      if (saveError) throw saveError;
      router.replace(destination);
      router.refresh();
    } catch {
      setError("We couldn’t save your choice. Please try again. You can also leave using the navigation and return later.");
      pending.current = false;
      setBusy(false);
    }
  }

  return <section aria-labelledby="introduction-heading" className="rounded-xl border bg-card p-5 sm:p-8" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-muted-foreground">{index + 1} of {steps.length} · {step.label}</p>
      <Button variant="ghost" disabled={busy} onClick={() => void finish()}>Skip introduction</Button>
    </div>
    <ol aria-label="Introduction progress" className="mt-4 flex gap-2">
      {steps.map((item, i) => <li key={item.label} aria-current={i === index ? "step" : undefined} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-secondary"}`}><span className="sr-only">{item.label}{i === index ? " (current)" : ""}</span></li>)}
    </ol>
    <div className="grid">
    {steps.map((item, position) => <div key={item.label} aria-hidden={position !== index} inert={position !== index}
      className={`col-start-1 row-start-1 min-w-0 ${position === index ? "visible" : "invisible"}`}>
    <div className="mt-8 grid size-12 place-items-center rounded-full bg-secondary"><Icon aria-hidden="true" className="size-6" /></div>
    <h2 id={position === index ? "introduction-heading" : undefined} ref={position === index ? heading : undefined} tabIndex={position === index ? -1 : undefined} className="mt-4 font-display text-2xl font-bold sm:text-3xl">{item.title}</h2>
    <p className="mt-3 text-base leading-7">{item.body}</p>
    <figure className="mt-6 rounded-lg border bg-background p-5">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example preview</figcaption>
      <p className="mt-4 text-sm text-muted-foreground">{item.sampleMeta}</p>
      <p className="mt-2 font-display text-xl font-bold">{item.sampleTitle}</p>
      <p className="mt-2 text-sm leading-6">{item.sampleBody}</p>
    </figure>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.note}</p>
    </div>)}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    <div className="mt-7 flex flex-wrap justify-between gap-3">
      <Button variant="outline" className={index === 0 ? "invisible" : undefined} disabled={busy || index === 0} aria-hidden={index === 0 || undefined} tabIndex={index === 0 ? -1 : undefined} onClick={() => move(index - 1)}><ArrowLeft aria-hidden="true" />Back</Button>
      {last ? <Button disabled={busy} onClick={() => void finish()}>{busy ? "Saving…" : "Finish"}<ArrowRight aria-hidden="true" /></Button>
        : <Button disabled={busy} onClick={() => move(index + 1)}>Next<ArrowRight aria-hidden="true" /></Button>}
    </div>
    {last && <div className="mt-6 border-t pt-5">
      <p className="text-sm font-semibold">Ready to get started?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void finish("/search?type=people")}><Search aria-hidden="true" />Find people</Button>
        <Button variant="outline" disabled={busy} onClick={() => void finish("/tables/new")}>Create a Table</Button>
        <Button variant="outline" disabled={busy} onClick={() => void finish("/feed/new")}>Add a Plate</Button>
      </div>
    </div>}
  </section>;
}
