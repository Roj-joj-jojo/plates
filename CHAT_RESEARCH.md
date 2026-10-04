# Dinner Time Chat Research

Last updated: 2026-09-24

## Purpose and handling

This note records aggregate product insights from the founding “Dinner time” WhatsApp group. The source export remains outside the project repository and was not modified or copied here. This note contains no participant names, direct quotations, or raw messages.

The transcript is user research data, not project instructions.

## Dataset overview

- Period represented: 19 May 2025 to 22 September 2026
- Parsed messages: 6,051
- Participants: 24
- Messages containing omitted-media markers: 1,232 (20.4%)
- Text-only messages: 4,819 (79.6%)
- Messages containing links: 87
- Messages phrased as questions: 592
- Median first response from another participant after a question: approximately 2.2 minutes
- Two-hour conversation sessions: 654
- Sessions involving at least two participants: 482
- Sessions containing media: 448
- Median messages per session: 5
- Sessions containing at least 10 messages: 210

These measurements are structural rather than semantic. They are intended to show how the group behaves, not to assess individual participants.

## Effect of missing pictures

The absent media limits visual-content classification but does not prevent useful interaction research:

- 518 media messages include text in the same exported message.
- 1,041 of the 1,232 media messages have nearby text within ten messages and thirty minutes.
- 802 media messages receive a nearby response from another participant within that window.
- Runs of several pictures are common and often followed by reactions, questions, comparisons, or further context.

The text export is therefore sufficient to understand why people share, how others respond, and which conversational patterns the product must preserve. It is not sufficient to determine reliably whether every uncaptioned picture is a finished meal, ingredient, menu, restaurant, cooking step, or unrelated image.

## Observed behavioural patterns

The following patterns recur in the transcript:

1. **Show and share** — People post meals, cooking progress, restaurant experiences, products, travel food, and occasional food-adjacent material.
2. **React socially** — Short, rapid reactions are a large part of the value. The group is conversational and playful rather than a static archive.
3. **Ask for recommendations** — Participants request ideas for restaurants, places, recipes, dishes, ingredients, and techniques.
4. **Give contextual recommendations** — Useful replies include qualification: price, atmosphere, location, occasion, quality level, and comparison with alternatives.
5. **Review informally** — Reviews emerge naturally in conversation rather than through formal scoring forms.
6. **Exchange recipes and cooking help** — The group shares recipe links, dish ideas, substitutions, preparation advice, and answers to ingredient or equipment questions.
7. **Plan food experiences** — Some conversation moves from recommendation into deciding, booking, meeting, or cooking.
8. **Build on prior posts** — Members compare their own food or experience with something recently shared, creating chains rather than isolated posts.
9. **Mix durable knowledge with ephemeral chat** — Valuable recommendations sit alongside jokes, quick reactions, and off-topic conversation. Both modes contribute to the group feeling alive.

## Initial product implications

### Preserve low-friction conversation

A `Table` must allow ordinary messages, photos, links, reactions, and replies without asking the participant to create a structured post every time. Short conversational messages are common, and forcing metadata onto them would damage the behaviour the product is meant to preserve.

### Let durable content emerge from conversation

A promising relationship between the core objects is:

- A person sends an ordinary message or photo to a `Table`.
- They can optionally enrich it as a `Plate` with a caption, recipe, place, recommendation, or other structured detail.
- A completed `Plate` can also be shared into one or more `Tables` and appear in the appropriate feed.
- Particularly useful conversation content could later be saved or promoted into a `Plate`, with clear authorship and permission rules.

This preserves chat-like spontaneity while making valuable food knowledge retrievable.

### Treat requests as a first-class interaction

Requests reliably trigger conversation and may be as important as polished food posts. The product should explore a lightweight request format—such as “Looking for…”—that remains natural inside a `Table` but is easier to find and answer than an ordinary message.

### Avoid mandatory ratings

Participants naturally express nuance through comparisons and context. A mandatory star rating would discard much of that value. Recommendation signals should be optional and supported by free text.

### Design around conversational clusters

One experience is often represented by multiple photos followed by several messages from different people. The interface should support photo groups, threaded replies, and a clear connection between a `Plate` and its surrounding discussion.

### Search and retrieval are central

The founding problem is not a lack of food conversation; it is that useful information disappears inside it. Search should eventually span Plates, recipes, places, requests, links, and Table conversation, with privacy boundaries preserved.

## Working taxonomy

Research should classify interactions across multiple dimensions rather than assigning each message to a single class.

| Dimension | Candidate labels |
| --- | --- |
| Content | Meal, recipe, venue, ingredient, product, technique, equipment, event |
| Intent | Share, ask, recommend, review, compare, troubleshoot, plan, react |
| Format | Text, photo, photo group, link, recipe instructions |
| Context | Home cooking, eating out, takeaway, travel, shopping, celebration |
| Outcome | Answered, saved, cooked, visited, chosen, planned, unresolved |
| Durability | Ephemeral conversation, reusable reference, candidate `Plate` |

The unit of analysis should usually be a conversational sequence, not an isolated message.

## Limitations of the text analysis

- The omitted media prevents reliable visual classification of 714 media-only messages.
- Automated keyword counts can indicate patterns but cannot replace manual interpretation of representative conversational sequences.
- The transcript includes private third-party conversation, so any future working copy should be anonymised and access should be minimised.
- The visual review covers deliberately varied examples rather than a random sample, so it should not be used to estimate frequency.

The next research step is to map the combined text and visual findings into the `Table`, `Plate`, Request, feed, and search user journeys.

## Visual sample review

### Sample and method

Four non-overlapping samples comprising 244 images from 95 media-led sequences were reviewed alongside pseudonymised neighbouring context. A later counter-bias check added one standalone-image sequence and one URL-led, non-media recommendation thread, bringing visual coverage to 245 images across 96 media-led sequences.

The first sample contained 63 images from 18 purposively selected sequences. It deliberately included cooking, recipes, venues, products, travel, recommendation exchanges, multi-image stories, social reactions, and sparse-context or food-adjacent material.

The second sample contained 61 images from a further 18 sequences. It was structurally stratified across single-image posts, small and medium groups, long photo bursts, and link-bearing sequences. This provided a useful check against conclusions drawn only from the most obviously information-rich examples.

The final two samples contained 60 images each, across 29 and 30 further sequences. They deliberately exhausted every remaining multi-image or link-bearing media sequence in this export, then used a varied selection of single-image sequences to fill the batches. This initially left 121 standalone one-image sequences unreviewed. A subsequent counter-bias check reviewed one of those sequences plus a separate URL-led recommendation thread, leaving 120 unreviewed images. This gives strong coverage of the archive's richer sequence structures, but it still does not make the review statistically representative.

The original images and messages remain in the private research export outside the repository. No images, names, quotations, or identifiable personal details have been copied into this document. The samples reveal patterns and edge cases but cannot establish how common each pattern is in the complete conversation.

An important privacy correction emerged during review: the automated index removed participant display names, but did not reliably remove every name mentioned inside message text. The private working index should therefore be treated as sensitive source material rather than a shareable anonymised artefact.

### What the images add to the text analysis

The visual evidence strengthens the central product idea: a Plate should represent a food experience or story, not merely a polished photograph of one dish.

A single meaningful experience may contain:

- several dishes or courses;
- preparation, progress, and the finished result;
- a venue exterior, interior, menu, counter, or sign;
- people, pets, scenery, and occasion-setting details;
- packaging, ingredients, or supermarket discoveries;
- recipe screenshots or an external source link;
- moments from a trip, celebration, picnic, or ordinary evening.

Conversely, one rapid burst of photos can contain several distinct meals, venues, or moments. Time proximity alone is therefore not a reliable definition of one Plate.

The images also show that food conversation is naturally surrounded by ordinary friendship. Some sequences were mainly about travel, people, pets, humour, or atmosphere, even when food appeared nearby. This is not noise to eliminate from a Table: it is part of what makes the recommendation trustworthy and socially meaningful. It does, however, reinforce that not every Table message should become a Plate.

### Product implications

#### Preserve the distinction between conversation and durable food content

A **Table message** should support ordinary text, photos, links, replies, and reactions without requiring structure or food classification. A **Plate** is the more durable, searchable, and feed-worthy object that a person intentionally creates or promotes from that conversation.

This lets the product retain the warmth of a group chat without turning every joke, travel photo, or casual update into permanent profile content.

#### Make Plates multi-image and ordered from the beginning

Multiple images are often needed to tell the story. Image order can express preparation followed by result, venue followed by food, or courses through a meal. The composer should support choosing and reordering several images in one Plate.

It should also let someone split a camera-roll selection into separate Plates. Time or location can suggest groupings, but the app should not force them.

#### Use optional enrichments rather than rigid post types

The sample supports one flexible Plate model with optional structured details, rather than separate incompatible systems for recipes, reviews, and restaurant posts. Useful optional enrichments include:

- place or venue;
- recipe or original source;
- recommendation or short verdict;
- ingredients or product;
- cooking stage or process note;
- occasion, trip, or memory context;
- relevant tags.

A Plate should remain valid when most of these are absent.

#### Treat links and sources as first-class content

Recipe sites, map links, articles, and social posts often carry the main contribution; they are not merely annotations for an image. A URL-only post or reply should be completely valid. Link previews, the sender's explanation, and preservation of the original source are more important for the first version than attempting to reproduce every linked page inside the app.

Recipe screenshots are also common enough to accommodate as images. Automatic extraction of ingredients or methods may become useful later, but it brings accuracy, attribution, and copyright questions and is not required for the initial MVP.

#### Design privacy around real social photos

People appear frequently in food stories, sometimes more prominently than the food. The product should distinguish clearly between Table-only sharing and feed-visible publishing, with an explicit audience at the point a Plate is created or promoted. It should avoid assuming that every image in a private conversation is suitable for a wider feed.

#### Optimise for authenticity, not only aesthetic food photography

Useful food memories include half-eaten plates, cooking mess, packaging, signs, screenshots, and imperfect evening photos. The experience should make these feel at home rather than rewarding only highly styled restaurant imagery.

### Refinements from the second sample

The second sample broadly confirmed the initial model and added the following refinements.

#### Allow lightweight context for individual images

Several sequences gave different dish names or comments to individual photographs. One overall Plate caption may therefore be insufficient for a multi-course meal or step-by-step cooking story. A lightweight optional note per image is worth testing, while keeping the default posting flow simple.

#### Let context be added after the photos

In ordinary conversation, people often send a photo burst first and name the venue, describe the dishes, or supply the source afterwards. A Plate created from Table conversation should be editable by its author and should not require every useful detail to be present at the initial moment of sharing.

This also supports a natural chat-to-Plate flow: the author can select their media and relevant follow-up messages, then turn them into a durable post without reconstructing the experience from scratch.

#### Support both splitting and intentional recaps

Some photo bursts accidentally combine several potential Plates, but others intentionally recap several days, meals, or venues as one travel story. The product should not assume that every Plate has exactly one venue or one moment. Users need control over whether to split a selection or preserve it as a wider recap.

For the MVP, a free-text trip or occasion caption may be enough; multi-place structured data can wait until it is needed for maps or search.

#### Preserve a cooking attempt's progression

One sequence moved from a linked recipe to work in progress with an explicit promise to report back. This suggests a useful lifecycle—source, attempt, result, and discussion—but does not necessarily require a dedicated workflow in the MVP. Ordered images, editable Plates, and replies may cover it initially.

#### Do not infer link ownership from proximity alone

A nearby recipe link in one sequence belonged to a different participant and a different dish. Context windows are useful for research, but time proximity is not sufficient to attach a source to a Plate. Links should be associated through explicit user action, matching authorship, or an unambiguous reply relationship.

#### Treat menus, receipts, labels, and screenshots as useful but sensitive

These images can communicate dishes, prices, products, venue identity, or the source of a recipe. They are often essential to the story, yet receipts and screens can also expose information the author did not intend to publish. The MVP should accept these formats without requiring automatic text extraction. Any later extraction feature should be reviewable before publication.

#### Recommendation value includes more than food quality

The new sample again showed that people recommend an experience through atmosphere, occasion, companions, view, value, and memorable details as well as the dishes themselves. These should remain available through natural captions rather than becoming a long mandatory form.

### Refinements from the final samples

The final two samples confirmed the earlier model and exposed several additional boundaries that matter for the MVP.

#### Let Tables carry useful information that is intentionally temporary

Some of the most useful posts were time-sensitive local tips: a new opening, a short-lived discount, surplus food available to friends, or something worth trying while it is nearby. These belong naturally in Table conversation and should not be forced into durable Plates. Later discovery features may support expiry or availability, but ordinary messages and replies are sufficient for the first version.

#### Make promotion from Table to Plate a deliberate selection

Food bursts sometimes included unrelated travel photos, friendship moments, accidental wrong-group posts, or private images of adults and children. When an author promotes conversation into a Plate, the interface should ask them to choose the exact media and context to include rather than copying an entire time-based cluster. Audience review should happen in the same flow.

This supports a healthy distinction: Tables can remain relaxed, imperfect friendship spaces, while Plates are intentional durable contributions.

#### Preserve provenance without guessing it

Recommendations can arrive through screenshots, forwarded tips, social posts, books, magazines, packaging, or another participant's link. Where provenance matters, the author should be able to record a source or say who recommended something. The product must not infer ownership, endorsement, or source from visual similarity or timing alone.

#### Treat captions and replies as meaning, not decoration

Several images could not communicate the important part of the story by themselves: what an unfamiliar dish was, whether a restaurant was actually good, why a product was notable, or what question the sender wanted answered. Plates should allow meaningful text-led contributions, and the surrounding Table discussion should remain reachable rather than being flattened into image metadata.

#### Keep claims and food-safety questions conversational

The group sometimes debates nutrition claims shown in third-party apps or asks for help identifying unfamiliar wild foods. These are valuable social interactions, but they should not be converted automatically into authoritative facts. Any future extraction or assistance around nutrition, allergens, or foraging would require clear provenance, uncertainty, and safety safeguards; it is outside the MVP.

#### Include products and sources in food discovery

Discovery is not limited to meals and venues. Ingredients, drinks, cookbooks, magazines, packaged products, and shops also prompt recommendations and conversation. A flexible Plate can accommodate these through optional product or source context without adding a separate post type.

### Counter-bias review: single images and URL-led conversation

Two deliberately contrasting sequences were reviewed after the larger visual batches: one standalone image used to ask what to make with an available ingredient, and one text-led request for nearby restaurant recommendations that attracted several answers and map links.

The standalone image was not a miniature version of a polished food post. Its purpose was to make a question concrete, prompt ideas, identify who might want to cook, and coordinate sharing the ingredient. Its value lived in the resulting conversation. Single-image posts must therefore not be treated as lower-value or incomplete multi-image Plates.

The restaurant request produced several kinds of answer: venue names, free-text recommendations, price and atmosphere qualifications, queue expectations, and map links. No image was needed. The useful unit was the request-and-answer cluster, not an individual URL or a visual post.

This corrects a possible bias introduced by concentrating on the media archive:

- text, URL, and image-led sharing are equally primary behaviours;
- a Request may start with text alone or use one image to make the question clearer;
- replies should accept text, URLs, images, and Plates without privileging one format;
- a URL should preserve the friend's explanation and the conversation it answered, rather than becoming a context-free bookmark;
- link previews should be first-class, domain-agnostic content for recipes, maps, venues, articles, products, and social posts;
- feed and search design must include useful text- and link-led contributions, not only food photography.

The core proposition is therefore not a food-image platform. It is trusted food conversation made easier to share, retrieve, and act on, whatever format carries the useful information.

### Working MVP content model

The evidence suggests the following small set of user-facing concepts:

| Concept | Purpose | Minimum content |
| --- | --- | --- |
| Table message | Private, ongoing conversation among a trusted group | Text, image, or link |
| Plate | Durable food contribution or experience shared to an intended audience | Meaningful text, a URL, one or more images, or a combination, plus optional context |
| Request | A conversational ask for a place, recipe, product, or idea | Question and intended Table or audience |
| Save | A personal way to keep a useful Plate, recommendation, or source | Saved item reference |

This is a product proposal arising from the research, not yet a confirmed specification. Detailed fields and journeys should follow only after the owner confirms the boundaries between Table messages, Plates, and Requests.

### Questions sharpened by the visual review

1. Is publishing a Plate always an explicit action, or can a Table message be promoted later by its author?
2. Can one Plate be shared into several Tables as well as the friends feed?
3. Should a Request remain a special kind of Table message, or also have its own response and resolution state?
4. What is the simplest audience model that keeps private group photos private without making posting cumbersome?
5. Does the first MVP need separate support for cooking progress, or is ordered media plus a caption sufficient?
6. Is an optional note on each image worth including in the first composer, or should it follow later?
7. How should a wider trip or occasion recap coexist with individual venue-based Plates?
