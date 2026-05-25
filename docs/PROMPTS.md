# Prompts — De Wonderkrik

Alle Claude- en Gemini-prompttemplates. Variabelen staan tussen `{accolades}`.

---

## Hoe het consistentiesysteem werkt

Het verhaal heeft **meerdere wereld-staten**. Welke wereld-staat geldt hangt af van de paragraaf
die geïllustreerd wordt. Een illustratie bij §10 (vóór de verplaatsing) moet een normale
1956-strand tonen. Een illustratie bij §47 toont de zeebodem met een groen waterplafond boven.
Een illustratie bij §84 toont de 2006-toeristische attracties.

De Gemini-beeldprompt is daarom opgebouwd uit **drie onafhankelijke lagen**:

```
[LAAG 1] CHARACTER SHEET      ← globaal, gecached (Prompt 0)
[LAAG 2] WORLD STATE          ← fase-afhankelijk, opgezocht via WORLD_CONTEXT.md §6
[LAAG 3] SCENE PROMPT         ← scène-specifiek, gegenereerd door Prompt 4
```

**WORLD_CONTEXT.md** is het primaire referentiedocument voor wereld-staat en Bordewijks stijl.
Raadpleeg het bij elke illustratie. Lees sectie §6 (snelle naslaginformatie) om te bepalen
welke fase een paragraaf heeft, en gebruik dan de bijbehorende fasebeschrijving uit sectie §4.

---

## Claude-prompts

### Prompt 0 — Character sheet genereren

**Doel:** één keer uitvoeren vóór de eerste afbeelding. Genereert uitsluitend het
CHARACTER SHEET en de FORBIDDEN-lijst. Wereld-regels staan NIET in dit profiel
(die zijn fase-afhankelijk — zie WORLD_CONTEXT.md). Output gecached in `wk_consistency`.

```
You are a visual continuity editor for an illustrated edition of
"Verplaatsing van elementen" by F. Bordewijk (1951).

Read the story and generate a compact character sheet in English,
intended exclusively as a fixed prefix for AI image prompts.

Do NOT include world rules — those are scene-dependent and handled separately.

STORY:
{FULL_STORY_TEXT}

Output in exactly this format, no other text:

CHARACTER SHEET
- Bordemanse: short legs, long torso, cross-eyed, ~20 years old (1956 scenes) or ~70 (2006 scenes), wears a hat, 1950s Dutch bourgeois dress, stiff posture, never hysterical
- Drebbel: even shorter legs than Bordemanse, compact build, carries a small briefcase, 1950s Dutch scientist type, chest puffed with pride, middle-aged, practical clothing

RECURRING VISUAL ELEMENTS
- [recurring element 1]
- [recurring element 2]
- [...]

FORBIDDEN
- No sea at ground level in any scene after §19
- No puddles, rain, or flowing water on the ground after §19 (except tiny ceiling deposits)
- No modern technology (smartphones, current cars) in 1956 scenes
- No dramatic facial expressions — tone is dry, ironic, understated throughout
- The sea rising as a flood/tsunami (it rises vertically as a plate, does not surge toward shore)
- The jack (krik) appearing in any scene after §23 (it was destroyed)
- [any additional forbidden elements you identify from the text]
```

---

### Prompt 1 — Scèneselectie (automatisch, Modus A)

Doel: Claude kiest het meest visueel rijke moment uit het verhaal.

```
You are a visual editor specializing in literary illustration.

The story is "Verplaatsing van elementen" by F. Bordewijk (1951).
It is told by a 70-year-old narrator in 2006, looking back at events of 18 July 1956.
The story unfolds in three phases: (1) normal 1956 Dutch beach before the event,
(2) a journey across the dry seabed after all water has been displaced 3km upward,
(3) a 2006 retrospective of a radically changed world.

STORY:
{FULL_STORY_TEXT}

Choose the single moment best suited for one dramatic illustration. Prefer moments with:
- Strong visual impact
- Clear spatial composition
- Representative of the story's dry, ironic atmosphere

Reply exclusively as JSON, no other text:
{
  "paragraph_ids": [<array of paragraph numbers, e.g. [12, 13]>],
  "phase": "<one of: pre-event | rising | post-event-shore | seabed-journey | french-village | alderney-murder | 2006>",
  "scene_title": "<short Dutch title>",
  "visual_description": "<Dutch description of what is visible, 2–4 sentences>",
  "key_elements": ["<visual element 1>", "<visual element 2>", ...]
}
```

---

### Prompt 2 — Scèneselectie (automatisch, Modus B — kleine reeks)

```
You are a visual editor specializing in literary illustration.

The story is "Verplaatsing van elementen" by F. Bordewijk (1951).
Narrator: 70-year-old Bordemanse in 2006, recalling July 18, 1956.
World: all water displaced 3km upward — but this happens mid-story (around §15–19).
Before that: normal 1956 Netherlands. After: dry seabed journey, changed world.

STORY:
{FULL_STORY_TEXT}

Choose {N} moments (3–5) that together form a visually coherent series representing the story.
Ensure variety in atmosphere and composition. Prefer moments that show the story's arc
(before the event, the event itself, the seabed journey, aftermath).
Avoid choosing multiple scenes from the same phase.

Reply exclusively as JSON, no other text:
[
  {
    "paragraph_ids": [<paragraph numbers>],
    "phase": "<pre-event | rising | post-event-shore | seabed-journey | french-village | alderney-murder | 2006>",
    "scene_title": "<short Dutch title>",
    "visual_description": "<2–4 sentences>",
    "key_elements": ["<element>", ...]
  },
  ...
]
```

---

### Prompt 3 — Verhaal segmenteren (Modus C — grafische roman)

```
You are a graphic novel adapter specializing in literary-to-comics adaptation.

The story is "Verplaatsing van elementen" by F. Bordewijk (1951).

KEY NARRATIVE FACT: The water displacement happens at §15–19.
- Panels from §6–§14: normal 1956 beach — sea on the ground, normal sky.
- Panels from §15–§19: the transition — sea rising as a vertical plate.
- Panels from §20–§76: dry seabed journey — water hanging 3km above as a green ceiling.
- Panels from §77–§93: 2006 retrospective — water still 3km high, now normalized.

STORY:
{FULL_STORY_TEXT}

Divide the story into exactly {N} panels for a graphic novel.
Ensure panels cover the full story and are narratively logical.
For each panel, include scene title, visual description, caption text (max 35 words),
and note the phase so the world state can be determined correctly.

Reply exclusively as JSON, no other text:
[
  {
    "panel_number": 1,
    "paragraph_ids": [<paragraph numbers>],
    "phase": "<pre-event | rising | post-event-shore | seabed-journey | french-village | alderney-murder | 2006>",
    "scene_title": "<short Dutch title>",
    "visual_description": "<what is visually shown, 2–4 sentences>",
    "key_elements": ["<visual element>", ...],
    "caption_text": "<max 35 words, direct quote or paraphrase from the text>",
    "balloon_text": "<max 15 words of dialogue as speech balloon, or null>"
  },
  ...
]
```

---

### Prompt 4 — Beeldpromptgeneratie (per scène)

Doel: vertaal scènebeschrijving + stijlwaarden + fase-afhankelijke wereld-context naar een Gemini-beeldprompt.

**Belangrijk:** `{WORLD_STATE_CONTEXT}` is een fragment uit WORLD_CONTEXT.md, sectie 4,
dat correspondeert met de fase van de te illustreren scène. Zie de fasebeschrijvingen aldaar.
De code bepaalt welk fragment te selecteren op basis van het `phase`-veld uit Prompt 1/2/3.

```
You are an expert at writing prompts for AI image generators.

Generate a detailed image prompt for the following scene from
"Verplaatsing van elementen" by F. Bordewijk (1951).

AUTHOR STYLE NOTE:
Bordewijk writes with dry, precise irony. The absurd is treated as mundane.
Disaster is described with the tone of a notary reading a will.
Compositions should be calm and precise, never hysterical or dramatic.
Dutch 1950s realism — muted palette, flat horizons, exact proportions.
The power comes from scale contrast: the cosmically impossible next to the trivially domestic.

CHARACTER SHEET:
{CHARACTER_SHEET}

WORLD STATE FOR THIS SCENE:
{WORLD_STATE_CONTEXT}

SCENE:
Title: {SCENE_TITLE}
Visual description: {VISUAL_DESCRIPTION}
Key elements: {KEY_ELEMENTS_JOINED}

STYLE INSTRUCTION:
- Strip / Bande dessinée (Hergé, Franquin): {W1_PCT}%
- Jugendstil / Art Nouveau (Mucha, Klimt): {W2_PCT}%
- Retro-science fiction 1950s (pulp SF covers): {W3_PCT}%
Realism level: {REALISM_LABEL} ({REALISM_VALUE}/100)

Write an English image prompt of 80–120 words.
Cover: composition, lighting, color palette, atmosphere, style.
No text or lettering in the image unless explicitly requested.
Reply exclusively with the prompt, no explanation.
```

---

### Prompt 5 — Onderschrift genereren (optioneel)

```
Het volgende is een fragment uit "Verplaatsing van elementen" van F. Bordewijk:

{PARAGRAPH_TEXT}

Kies of parafraseer één zin die geschikt is als onderschrift bij een illustratie
van dit moment. Maximaal 20 woorden. Behoud de stijl van Bordewijk: precies,
droog, licht ironisch. Antwoord uitsluitend met de zin, geen aanhalingstekens,
geen uitleg.
```

---

## Fase → wereld-context mapping

De code gebruikt dit schema om het juiste `{WORLD_STATE_CONTEXT}`-fragment te selecteren
uit WORLD_CONTEXT.md sectie 4.

| Phase-waarde | Paragrafen | Gebruikt WORLD_CONTEXT.md sectie |
|---|---|---|
| `frame-2006` | §1–§5 | Fase 0 + Fase 5 (dit IS de 2006-wereld) |
| `pre-event` | §6–§14 | Fase 1 (normale zee, 1956 strand) |
| `rising` | §15–§19 | Fase 2 (zee stijgt als plaat) |
| `post-event-shore` | §20–§33 | Fase 3 (zee weg, droog strand, 3km hoog) |
| `seabed-journey` | §34–§63 | Fase 4a + 4b (rijwielrit, wrakken, Frans dorp) |
| `alderney-murder` | §64–§76 | Fase 4c (lichtschacht, moord, terugkeer) |
| `2006` | §77–§93 | Fase 5 (nieuwe wereld, champagneglazen, etc.) |

---

## Gemini beeldprompt-structuur (eindresultaat)

De uiteindelijk naar Gemini gestuurde prompt is opgebouwd uit drie lagen:

```
{CLAUDE_GENERATED_SCENE_PROMPT}

Style emphasis: {DOMINANT_STYLE_DESCRIPTION}
Color palette: {PALETTE_BASED_ON_STYLE}
Technical: {REALISM_TECHNICAL_TERMS}
No text, no lettering, no speech bubbles in the image.
```

### Stijl-naar-prompt-vertaaltabel

| Stijl | Visuele trefwoorden |
|---|---|
| Strip (dominant) | ligne claire illustration, flat colors, bold ink outlines, Belgian comics style, Tintin aesthetic |
| Strip (accent) | clean outlines, graphic simplicity |
| Jugendstil (dominant) | Art Nouveau illustration, ornate flowing lines, Mucha-style, decorative borders, organic curves, gold and green palette |
| Jugendstil (accent) | flowing organic lines, decorative elements |
| Retro-SF '50 (dominant) | 1950s science fiction pulp cover art, retro-futurism, dramatic lighting, vintage magazine illustration |
| Retro-SF '50 (accent) | retro-futuristic details, atomic age aesthetic |

### Realisme-naar-prompt-vertaaltabel

| Waarde | Trefwoorden |
|---|---|
| 0–25 | stylized illustration, flat graphic, painterly |
| 26–50 | semi-realistic illustration, detailed painting |
| 51–75 | realistic illustration, detailed rendering |
| 76–100 | photorealistic, hyperrealistic, detailed photography style |

### Dominantiebepaling

De dominante stijl (hoogste gewicht) bepaalt het hoofdkarakter van de prompt.
Secundaire stijlen (gewicht > 15%) worden als accent toegevoegd.
Stijlen onder 15% worden weggelaten.

---

## Voorbeeld — volledig gegenereerde beeldprompt

**Scène:** §47 — De rijwielrit over de zeebodem, wrak met waterkolommen (fase: `seabed-journey`)
**Stijl:** Strip 30% / Jugendstil 50% / Retro-SF 20% / Realisme 35

**WORLD_STATE_CONTEXT (uit WORLD_CONTEXT.md Fase 4a):**
```
The North Sea hangs 3km above as a vast ceiling. Lighting from above is filtered
green twilight — varying from pale green over shallow former areas to near-black
over former deep water. The seabed is dry, compressed sand almost like sandstone.
Dying sea life (starfish, flatfish, drying seaweed) litters the floor.
Shipwrecks stand intact. Inside wrecks: free-standing vertical water columns
of various thicknesses — water trapped by the sealed hulls that could not rise.
```

**Claude output (Prompt 4):**
```
Two small figures on a 1950s Dutch moped ride across a vast dry seabed under a
towering green water ceiling three kilometers above. Nearby, a rusted submarine
wreck stands half-buried in compacted sand. Through a gash in the hull, bizarre
free-standing columns of water rise vertically from floor to ceiling — still,
transparent, impossible. Dying starfish and dried seaweed on the sandy floor.
Art Nouveau illustration with flowing decorative borders, Mucha-inspired arching
composition, pale green and deep teal palette with gold accents, subtle ligne
claire outlines. The impossible rendered with Dutch bourgeois matter-of-factness.
Semi-realistic, detailed painting. Low horizon, dramatic upward perspective.
```

**Toegevoegde technische lagen:**
```
Style emphasis: Art Nouveau dominant, flowing decorative borders, organic curves.
Color palette: deep ocean green, gold, sandy beige, pale aqua, rust-brown.
Technical: semi-realistic illustration, detailed painting.
No text, no lettering, no speech bubbles in the image.
```

---

## Bestandsnaamconventie voor PNG-output

```
wk_§{PARA_IDS}_s{W1}-{W2}-{W3}_r{REALISM}.png
```

Voorbeeld: `wk_§46-47_s30-50-20_r35.png`
