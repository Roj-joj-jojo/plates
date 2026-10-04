# Product Discovery Notes

Last updated: 2026-09-28

## Purpose

This document records anonymised product insights gathered outside the founding chat analysis. It distinguishes observations from interpretations and proposals. No participant names, quotations, or identifying details should be recorded here.

## 2026-09-25 — Informal conversation with two prospective users

### Context and evidence strength

The owner discussed Plates informally with two close friends who resemble the initial target audience. This is useful directional evidence, but it is not a formal interview or independent validation: the participants are personally close to the owner, heard the idea together in a social setting, and may be inclined to encourage it.

### Observations

- Both people initially expressed concern about the privacy implications of using a private group conversation for product research.
- They became more comfortable after hearing that the analysis focuses on anonymised interaction patterns and aggregate insights rather than retaining or reproducing conversations in the project.
- After the explanation, both responded enthusiastically to the product idea.
- One participant compared the concept with Goodreads, the social platform for book discovery and recommendations.
- One participant independently proposed searching or querying by ingredient to discover how friends use what they have, including recipes and meal ideas. The owner responded positively to this idea.

### Interpretation

#### Privacy is part of the proposition

Initial hesitation from trusted friends is a meaningful signal. Privacy must be understandable before someone shares, not justified only after concern arises.

Product implications include:

- Tables should be private by default with a plainly visible audience.
- Table content should never become feed content, a Plate, or a broadly searchable result without an explicit author action.
- Search results must be filtered by the viewer's existing access; search must not create a new route into private content.
- Promoting content from a Table should include an audience and media/context review.
- The product should explain what is stored, who can see it, and how a person can remove or change it in ordinary language.

For research, aggregate anonymised findings should remain separate from private source material. If source material is ever to be shared beyond the owner's private workspace or used for a materially different purpose, participant consent should be revisited first.

#### The Goodreads analogy is useful but incomplete

The Goodreads comparison reinforces the trusted-interest-network model: friends' activity, opinions, collections, and recommendations help someone decide what to try next. Potential food equivalents include:

- read / want to read → cooked, visited, saved, or want to try;
- bookshelves → personal food collections or lists;
- reviews and reading activity → Plates, recommendations, and cooking or visiting activity;
- friend discovery → trusted food discovery.

Plates differs because food decisions are often immediate and collaborative. A person may ask what to cook tonight, where to eat nearby, how to use an ingredient, or whether a recipe works. Tables and Requests therefore remain central rather than being secondary comments on a catalogue.

#### Ingredient-led discovery expresses a clear job

The underlying job is not merely “filter by tag.” It is:

> Show me what people I trust have cooked, shared, or recommended using what I already have.

This could connect recipes, meal Plates, saved URLs, and prior answers to Requests. It supports both planned discovery and immediate “what can I make?” decisions.

### Product proposal

For an initial version, ingredient discovery should stay lightweight:

- Search accepts ordinary ingredient words and can match accessible Plate text, recipe titles, captions, optional ingredient labels, and the sender's description of a URL.
- A Plate or recipe may have optional ingredient chips or a short ingredient list, but ordinary posting should not require exhaustive tagging.
- Search results can include Plates, recipe links, and relevant Requests or answers, with their source and audience context preserved.
- URL-only contributions remain first-class results.
- Automatic ingredient extraction from linked recipes should remain a later enhancement because it introduces accuracy, attribution, site-access, and maintenance concerns.

Ingredient tags may help, but tags alone are unlikely to be sufficient: people use synonyms, plural forms, broad categories, substitutions, and informal names. The first design should combine ordinary text search with optional structured ingredient information rather than depending entirely on manual taxonomy.

### Questions to test

1. Do people want exact ingredient matching, broad inspiration, or both?
2. Is one ingredient the common case, or do people usually want to enter several ingredients they need to use?
3. Should search cover private Table conversation, or only Plates, saved items, and explicitly reusable answers?
4. Will people add optional ingredient labels when posting, and what benefit makes that effort worthwhile?
5. Should results distinguish recipes a friend actually cooked from links they merely saved or shared?
6. Does “want to try” provide a useful food equivalent to a book-app reading list?

### Current status

Ingredient-led search is a promising discovery direction supported by spontaneous prospective-user input and the founding chat's existing recipe and ingredient exchanges. Its exact MVP scope is not yet confirmed.

## 2026-09-26 — First two sea-bass save-and-retrieve responses

### Context and evidence strength

The owner received two responses to a scenario about encountering a friend's sea-bass dinner photo, possibly receiving a recipe later, and returning to it. The questions covered retention, retrieval, photo-only usefulness, and connection to the source person or conversation.

These are two informal self-reports from friends, not observed usability tests or evidence of prevalence. Some answers describe existing habits; others describe hypothetical actions. The first question was open, but later questions explicitly offered photo, recipe, and conversation as possible save targets and prompted consideration of provenance. Consequently, not every theme should be described as unprompted. The second respondent described broader group-chat use without answering every scenario question individually. The owner described the friends as very different; the responses demonstrate different behaviours, but do not establish distinct user segments.

### Observations

- One respondent would probably take no immediate saving action, expecting to recover the item from the group. Browser history or an open recipe tab might also serve as a temporary reminder.
- That respondent recently began copying recipe text into a personal notes page. This is a concrete existing retention practice; keeping the recipe in the sea-bass scenario is a stated preference.
- They retrieve through group keyword search or by asking the group again. They would ask for more information when sufficiently interested, but report forgetting much of the useful content that passes through the conversation.
- They sometimes remember a recipe through the person who shared it, even when they have never made it. In other cases, they remember only the group as its source. Source association is variable rather than universally precise.
- The other respondent already uses the group as a reference for recipes and restaurant recommendations. They use keyword search and, more often by their account, browse images, helped by a rough memory of who posted and when.
- That respondent also browses images for general dinner inspiration without necessarily looking for a specific previously saved item.
- The second response does not establish a preferred save target, whether they would save photo-only content, or whether preserving the whole conversation matters.

### Interpretation

The responses support three related needs: retaining actionable information, recovering remembered content that was never deliberately saved, and browsing for inspiration. A Menu alone would not cover the latter two unless the material happened to have been saved first.

Recipe-first retention has direct support from one respondent's existing behaviour. This challenges an assumption that saving only the original meal photo is always sufficient. It does not resolve whether the product should save a conversational answer directly or let someone save a Plate enriched with that answer: neither implementation was tested.

Images can be retrieval cues and inspiration in their own right. This supports visual browsing alongside useful text and links; it does not establish that every Menu item needs an image or that the second respondent wants to save photos.

Source person and group can act as memory cues. Keeping a route back to the source may help, but neither response establishes a requirement to retain the entire conversation with every saved item. Any source connection remains subject to access boundaries.

### Proposals to discuss, not confirmed decisions

- Narrow the Menu requirement around keeping the useful material itself, including a recipe or explanation when that is what the person wants to reuse, with enough source context to recognise it later. Leave the precise save object open.
- Test whether saving useful Table material must work without waiting for its author to publish or enrich a Plate. The current evidence suggests this dependency could obstruct existing recipe-retention behaviour, but does not directly test it.
- Treat rediscovery without a prior save as a first-version search consideration. Keyword retrieval and browsing images within an accessible Table are concrete candidates; app-wide scope remains undecided.
- Preserve format-neutral sharing and retrieval. Visual browsing should complement access to text, links, recipes, and recommendations.

### Remaining questions

1. When a useful recipe exists only in a Table reply, should saving retain that reply directly, an enriched Plate, or another connected representation?
2. When the visual browser finds an old image, what do they use next: the image itself, accompanying text, a recipe link, or nearby replies?
3. What minimum source information helps recognition, and when is returning to the conversation necessary?
4. Which retrieval needs belong in the first version: Menu search, Table keyword search, Table image browsing, or broader accessible-content search?

These responses narrow the needs but do not settle publisher categorisation, automatic classification, Plate presentation inside Tables, or the MVP boundary.

### Owner decision after reviewing the findings

On 2026-09-26, the owner explicitly confirmed that a useful recipe remaining only a Table reply must still be directly saveable to the Menu. This confirms direct saving of useful Table contributions alongside Plates, without depending on author promotion or enrichment. It is a product decision informed by the feedback, not a claim that both respondents requested this exact design. The earlier proposals and questions above preserve the reasoning that preceded the decision; the question of whether a Table reply can be saved directly is now resolved. Saved-item presentation, detailed source behaviour, and categorisation remain open.

In a subsequent confirmation the same day, the owner agreed that a saved reply should show its useful content and who shared it, and explicitly requested an easy link or action back to where it was originally shared, citing Slack as an interaction reference. This narrows the presentation and source-connection questions: returning to the original contribution in context is confirmed. The detailed interface, treatment of source edits or lost access, and categorisation remain unresolved. No Slack integration is implied.

### Continuing discovery without blocking design

The owner confirmed on 2026-09-26 that additional friend responses will continue to be gathered but must not hold up product definition. Proceed using the evidence and confirmed decisions already available, label untested design choices as provisional, and use subsequent feedback to refine or challenge the model. More sea-bass responses are not a gate for Product Model v1, the MVP boundary, or screen mapping.

### Owner clarification: threads, search, and optional tags

The owner subsequently confirmed that Plate discussions within Tables should act as threads. Users should be able to search accessible Plates and within Tables they belong to, while Table content remains private to its members. Author-name search should help recover a Plate even if the author posted it without additional information.

Posting must allow a path with no extra tags or information. Authors should also have the option to add a few tags to help other people find the Plate. The owner expressed interest in content-based automatic tag suggestions but considered them unlikely to belong in the MVP; record these as provisionally deferred. Optional shared Plate tags do not by themselves settle personal Menu organisation or automatic categorisation.

These are owner product decisions and preferences, not additional prospective-user findings. Table image browsing, a combined search across multiple Tables, and precise thread placement have not been confirmed.

### Owner clarification: required categories and Table media browsing

The owner confirmed basic Table image browsing for MVP, citing the media view in a WhatsApp chat as the intended interaction. This includes browsing food images for rediscovery and inspiration within the Table's existing private audience.

The owner also clarified that low-friction Plate publishing still requires a broad category, for example Meal, Recipe, or Restaurant. Extra tags remain optional. This resolves the previously reopened publisher-categorisation question and corrects the earlier interpretation of posting without additional information. Broad categories should provide the Menu's initial sorting, while additional personal subcategories or collections can wait until after MVP. The precise category list and support for multiple categories remain undecided.

Working interpretation: a saved Plate carries its existing category into the Menu. Clarification was requested about whether the saver chooses a category for an uncategorised Table reply; that question remains open. Ordinary Table sharing must remain casual and does not require publishing a Plate.

These are owner decisions informed by the ongoing discussion, not new friend responses. Earlier notes are retained to show how the model changed.

The owner then confirmed the save-category rule explicitly: a saved Plate retains its author's category; a person saving an uncategorised Table reply chooses a broad category at that point. The latter category organises the personal saved item without changing the original Table message or publishing a Plate. No extra personal subcategorisation is required. This resolves the pending question above and qualifies the earlier immediate-save principle for Table contributions that lack a category.

## 2026-09-28 — Third sea-bass response

### Observations and evidence limits

- The respondent currently relies on keyword search in the group rather than taking an immediate saving action.
- Their stated ideal is to retain both the recipe and its photo. They perceive their current saving workflow as inadequate and instead expect to remember and search later.
- They are uncertain that a photo alone would prompt action and describe photos as difficult to retrieve through search.
- They speculate about searching image content using a food term. This is an expectation or question, not evidence that they use such a feature or that any particular app provides it.
- They explicitly value remembering the personal connection to the source.

This brings the sea-bass scenario to three informal responses. The existing questionnaire caveats apply: retention options and source connection were prompted, these are self-reports rather than observed behaviour, and an ideal saving preference is not proof of adoption.

### Interpretation alongside the earlier responses

All three respondents mention keyword retrieval. This strengthens the case for finding content without a prior save. The new response also supports retaining source identity, consistent with the agreed Menu author and return-to-source presentation.

The distinctive addition is the desire to keep recipe and photo together. A lack of current saving activity should not be interpreted as a lack of interest in saving: this respondent describes a missing convenient workflow. Their uncertainty about photo-only usefulness coexists with the earlier respondent's visual inspiration and browsing habits; neither should be generalised to everyone.

Direct saving of a Table reply remains appropriate, but it does not yet specify how an associated photo is presented in the Menu. A route back to the source may help, but has not been tested as sufficient for someone who wants both readily available.

### Proposed wireframe refinement, not an approved feature change

For a recipe saved from a Plate's Table thread, sketch the recipe as the main saved content with a small reference to the original Plate and its photo where available, retaining authorship and return-to-source navigation. Compare whether that conveys the desired relationship without requiring two separate saves. Use only an explicit source relationship; do not assume unrelated nearby photos belong to a recipe. Photo-free recipes remain valid.

This is a presentation proposal to discuss and test, not a decision to merge content, automatically attach media, or change the save object. Image-content search and automatic tag suggestions remain deferred; the response does not establish them as MVP requirements. Continue the current wireframe work without waiting for more responses.

### Subsequent owner clarification on the proposed save presentation

The owner clarified that the reviewed wireframe depicts a thread beneath a shared Plate, not a model in which any message creates a thread that can then be saved. The assistant's intended example was saving a single recipe reply from that existing Plate thread, without creating another thread. The owner has not yet considered the single-message save interface or how its Menu item would look. Discuss that behaviour explicitly before progressing the related-photo preview proposal. Earlier support for retaining useful conversational material does not settle a general message-saving interface, whole-thread saves, or nested threads.
