# Architectuur — Novelizer

---

## Multi-story architectuur (geïmplementeerd v0.028+)

De app ondersteunt meerdere verhalen via het `StoryDef`-formaat. Bibliotheek-UI, storywisseling en story creator zijn actief (fasen 0–4 voltooid).

### Kernprincipe: `StoryDef` als interface-contract

Elk verhaal is één JS-object. De generator, storage en story view kennen een verhaal uitsluitend via dit object — geen story-specifieke hardcoding buiten `js/stories/`.

```javascript
export default {
  id: 'bordewijk_verplaatsing',       // slug → localStorage-prefix nv_{id}_*
  title: 'Verplaatsing van elementen',
  author: 'F. Bordewijk',
  year: 1956,                         // jaar van de verhaaltijd (niet publicatie)
  genre: 'kort verhaal',
  fileCode: 'VE',                     // 2 hoofdletters → bestandsnaamprefix (VE_001_…)
  writerStyle: 'laconiek, droog, vervreemdend, journalistiek',
  sourceUrl: 'https://…',             // optioneel — klikbare link in header
  worldRules: `WORLD RULES — …`,     // zie §"Van verhaal naar afbeelding"
  chapters: [{ id: 'ch1', title: '…' }],
  paragraphs: [{ id: 1, chapter: 'ch1', text: '…' }],
  defaultStyle: { w1: 0.5, w2: 0.3, w3: 0.2, realism: 30 },
};
```

**`fileCode`** — 2 hoofdletters die als bestandsprefix voor alle gegenereerde afbeeldingen dienen. Voor door `story_creator.js` gegenereerde verhalen vraagt Claude een code voor; als fallback: eerste letters van de twee meest significante titeltitelwoorden (stopwoorden uitgesloten).

### Bestandsstructuur

```
novelizer/js/
├── stories/
│   ├── bordewijk_verplaatsing.js   ← StoryDef Verplaatsing van elementen (VE)
│   ├── de_bioscoop.js              ← StoryDef De Bioscoop (BC)
│   ├── meneer_pem_heeft_een_droom.js ← StoryDef Meneer Pem heeft een droom (PD)
│   ├── bolifur_saga.js             ← StoryDef De Saga van Bolifur de Paling (BS)
│   ├── koning_pinteman.js          ← StoryDef Koning Pintenman (KP)
│   ├── welcome_to_the_internet.js  ← StoryDef Welcome to the Internet (WI)
│   └── index.js                    ← STORY_LIBRARY array + DEFAULT_STORY_ID
├── story_library.js                ← getLibraryStories(), addUserStory(), getActiveStory()
├── story_creator.js                ← generateStoryDef(text, signal) via Claude
├── story_data.js                   ← tijdelijke shim (re-export voor legacy consumers)
├── story_view.js                   ← verhaalweergave; setStory(def) voor live-wissel
├── generator.js                    ← setStory(def), this._story, story-agnostisch
├── storage.js                      ← setActiveStoryId(id), namespaced helpers
├── output.js                       ← galerij, voorbeeld-picker, composite PNG export, ZIP
└── app.js                          ← bibliotheek-UI, _switchStory(), creator-modal
```

### Storage namespacing

Story-specifieke sleutels: `nv_{id}_*`. Globale sleutels: `nv_*`.

| Story-specifiek (`nv_{id}_*`) | Globaal (`nv_*`) |
|---|---|
| `consistency` | `key_claude`, `key_gemini` |
| `consistency_ts` | `model_gemini`, `style` |
| `char_appearances` | `mode`, `strip_style`, `b_count`, `novel_count` |
| `style_proof` | `text_opts`, `gen_strategy`, `debug` |
| `marks` | `calibration`, `show_para_nums` |
| `seg_bounds`, `intra_splits` | `active_story` (welk verhaal actief) |

Bij storywisseling roept `_switchStory()` `storage.setActiveStoryId(id)` aan — alle namespaced helpers lezen daarna automatisch de juiste prefix.

### Implementatiefasen

| Fase | Scope | Status |
|---|---|---|
| **0** | StoryDef-formaat; `stories/` directory; index.js | ✅ |
| **1** | Generator story-agnostisch: `setStory()`, `this._story` | ✅ |
| **2** | Storage namespacing: `setActiveStoryId`, namespaced helpers | ✅ |
| **3** | Bibliotheek-UI + verhaalwisseling | ✅ |
| **4** | Story creator: vrije tekst → StoryDef via Claude; export/import JSON | ✅ |
| **5** | `fileCode`-conventie; composite PNG export; dev-save (`?dev=1`); Bolifur-verhaal | ✅ |

### Bestandsnaamconventie

Alle gegenereerde afbeeldingen: `{fileCode}_{seq:003}_{YYMMDD}_{HHmm}_{scenetitle}_§{ids}_s{w1}-{w2}-{w3}_r{realism}.png`

- `fileCode` — 2 hoofdletters uit StoryDef (`VE`, `BS`, …)
- `seq` — volgnummer binnen de run, 3 cijfers (`001`, `002`, …); karakterreferentie is altijd `000`
- Volgorde: `seq` staat vóór datum, zodat bestanden per run alfabetisch sorteren

ZIP-naam: `{fileCode}_{titleSlug}_{datum}_{n}afb.zip` — met titel, datum en aantal afbeeldingen.

### Composite PNG export

Na het voltooien van een generatierun toont de uitvoerkolom de knop "↓ Exporteer met tekst". Dit maakt voor elke afbeelding een nieuwe PNG via de Canvas API:

```
┌───────────────────────────────┐
│  Originele afbeelding         │
│  (832×1216 of 1024×1024)      │
├── separator ──────────────────┤  ← 2px, #2a2a2a
│  Scènetitel  (bold 20px)      │  ← links uitgelijnd
│  Bijschrift / caption         │  ← word-wrapped, 15px
│  Verhaal — Auteur · Jaar      │  ← footer, 12px, gedimmed
└───────────────────────────────┘
```

Karakterreferentie krijgt een titelblad met verhaaltitel, auteur, jaar. ZIP-naam heeft suffix `_composiet`.

### Dev-save (`?dev=1`)

In de creator-modal verschijnt bij `?dev=1` de knop **"📋 Print als JS"**. Hij formatteert de actieve `_creatorLastDef` als kant-en-klaar JS-modulebestand en print het naar de console (plus clipboard als dat beschikbaar is). Kopieer de output naar `js/stories/{id}.js` en registreer het in `js/stories/index.js`.

---

## Van verhaal naar afbeelding — de informatiepipeline

Elke gegenereerde afbeelding put uit **vijf informatiebronnen**. Drie worden eenmalig klaargezet per verhaal; twee worden per generatierun bepaald.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  EENMALIG KLAARZETTEN (per verhaal)                                     │
├──────────────┬──────────────────────────────────────────────────────────┤
│ 1. StoryDef  │ worldRules, paragraphs, writerStyle, defaultStyle        │
│              │ → aangemaakt via creator of geïmporteerd als JSON        │
├──────────────┼──────────────────────────────────────────────────────────┤
│ 2. Consis-   │ CHARACTER SHEET + SCENE PROPS + CHARACTER APPEARANCE     │
│    tentie-   │ → gegenereerd door Claude via "Genereer profiel"         │
│    profiel   │ → opgeslagen als nv_{id}_consistency + char_appearances  │
├──────────────┼──────────────────────────────────────────────────────────┤
│ 3. Stijl-    │ Triangle (w1/w2/w3) + realism-slider + stripstijl       │
│    instellin │ → globaal, niet per verhaal                              │
│    gen       │ → defaultStyle uit StoryDef als startpunt               │
├──────────────┴──────────────────────────────────────────────────────────┤
│  PER GENERATIERUN                                                       │
├──────────────┬──────────────────────────────────────────────────────────┤
│ 4. Kalibratie│ Gemini-karakteropstelling van alle hoofdpersonages       │
│    (style    │ → gegenereerd aan het begin van elke run                 │
│    proof)    │ → gebruiker keurt goed of regenereert                    │
│              │ → opgeslagen als nv_{id}_style_proof                     │
│              │ → als referentie-afbeelding meegegeven aan alle          │
│              │   volgende Gemini-calls in die run                       │
├──────────────┼──────────────────────────────────────────────────────────┤
│ 5. Scènes    │ Claude selecteert of gebruiker markeert paragrafen       │
│              │ → Claude genereert visuele beschrijving + Gemini-prompt  │
│              │ → per scène: active_characters + temporal_version        │
│              │ → per scène: composition_type (mode C), world_state      │
└──────────────┴──────────────────────────────────────────────────────────┘
```

### 1. StoryDef — de fundering

**`worldRules`** is de kritischste veld voor beeldkwaliteit. Het wordt zonder uitzondering in *elke* Gemini-prompt opgenomen — ook bij fotorealisme. Goede worldRules bevatten:

- **Visueel universum** — tijdperk, locatie, technologieniveau, kledingstijl
- **Unieke of ongewone wereld-features** — wat maakt dit verhaal visueel onderscheidend?
- **FORBIDDEN-lijst** — wat mag Gemini nooit tonen (foutieve technologie, anachronismen, verwarde props)
- **Atmosfeer** — droog, onheilspellend, onschuldig, surrealistisch, etc.

**`writerStyle`** wordt gebruikt in caption- en balloon-prompts: "Behoud de schrijfstijl van [author]: [writerStyle]."

**`defaultStyle`** — startwaarden voor de stijldriehoek wanneer het verhaal voor het eerst geladen wordt. Stijl is globaal, dus de gebruiker kan daarna handmatig bijstellen.

### 2. Consistentieprofiel — karakters en props

Gegenereerd door `_generateConsistencyProfile()` in `generator.js`. Claude leest de *volledige* verhaaltekst en produceert een Engels plaintext-profiel met drie secties:

**CHARACTER SHEET** — voor elk hoofdpersonage:
- Naam, rol in het verhaal
- Visuele beschrijving per tijdversie (bijv. `· 1956 young`, `· 2006 old`)
- Kenmerkende kleding, houding, gezichtskenmerken

**SCENE PROPS** — eigendoms-mapping:
- Welk object hoort bij welk personage?
- Voorkomt dat Gemini props verkeerd toewijst (bijv. fiets van personage A bij personage B)

**CHARACTER APPEARANCE** — gedetailleerde uiterlijk-regels:
- Per personage/tijdversie: haarkleur, lengte, bouw, specifieke kenmerken
- Gebruikt in de kalibratie-prompt en in scène-specifieke prompts
- Optioneel: een regel met rol-label `(major non-human element)` voor een niet-menselijk element dat herhaaldelijk en op grote schaal voorkomt (bijv. een gigantisch voertuig) — krijgt dezelfde precisie (afmetingen, vorm, kleur, oppervlak, beweging) en wordt apart behandeld in de kalibratie (zie §4)

Het profiel wordt als `nv_{id}_consistency` gecached (persisterend) en als `nv_{id}_char_appearances` apart opgeslagen. Bij elke Gemini-call wordt het als vaste prefix in de prompt opgenomen.

**Aanbeveling:** genereer het profiel opnieuw na grote wijzigingen aan de verhaaltekst.

### 3. Stijlinstellingen — globaal en overdraagbaar

De stijldriehoek (w1/w2/w3) en realism-slider zijn bewust globaal. Zo kun je dezelfde visuele stijl op meerdere verhalen toepassen zonder per verhaal opnieuw in te stellen. De `defaultStyle` in de StoryDef dient alleen als startpunt bij eerste gebruik.

### 4. Kalibratie (style proof) — visueel anker per run

Aan het begin van elke generatierun (als ingeschakeld) laat `_generateCalibrationImage()` Gemini een *karakteropstelling* genereren: alle hoofdpersonages naast elkaar, full body, neutrale achtergrond. Dit beeld:

- Verankert de visuele identiteit van de personages voor die run
- Wordt als base64-referentie-afbeelding meegegeven aan *alle* volgende Gemini-calls
- Geeft de gebruiker controle: goedkeuren of opnieuw genereren (met optionele bijsturing)

De kalibratie-prompt puurt automatisch de actieve personages uit `char_appearances` en telt ze (`charCount`), zodat nooit te veel of te weinig figuren worden getekend.

Een `(major non-human element)`-regel (zie §2) telt niet mee in `charCount` en wordt niet in de mens-lineup geplaatst. In plaats daarvan krijgt `_generateCalibrationImage()` een extra instructie om dat element in dezelfde afbeelding op ware schaal te tonen (bijv. enorm en ver weg op de horizon achter de personages) — zo wordt ook het ontwerp van zo'n element (vorm, kleur, oppervlak) als visueel anker voor de hele run vastgelegd, in plaats van per scène opnieuw verzonnen te worden.

### 5. Scènes — scènekeuze en prompt-opbouw

Per scène roept Claude (`_generateClaudePrompt()`) de visuale beschrijving op. Claude krijgt:
- De verhaaltekst van de geselecteerde paragraaf(en)
- Het consistentieprofiel (als er `charAppearances` zijn)
- Instructies over `active_characters` en hun `temporal_version`
- `correctionNote` bij herGeneratie (optionele vrije bijsturing)

Claude's output is een korte visuele scènebeschrijving (wat is zichtbaar, wie staat waar, wat doen ze). Die gaat als `SCENE CONTENT` in de Gemini-prompt.

### Samenstelling van de Gemini-prompt (`buildFinalGeminiPrompt`)

Elke afbeeldingsprompt is een geordende aaneenschakeling:

```
[1] ART STYLE block            ← stijlmix (w1/w2/w3)
[2] RENDERING bridge note      ← relatie ART STYLE ↔ stripstijl (als actief)
[3] FIDELITY LEVEL / RENDERING ← realism-slider output
[4] COMIC BOOK RENDERING       ← stripstijl definitie (als actief) — incl. COMPOSITION EXECUTION
[5] WORLD RULES                ← storyDef.worldRules — ALTIJD aanwezig
[6] CHARACTER SHEET + PROPS    ← consistency profile (als aanwezig)
[7] STYLE REFERENCE NOTE       ← instructie voor gebruik style proof ref-afbeelding
[8] COMPOSITION directive      ← alle modi: scene.composition_directive (vrije tekst)
[9] ACTIVE CHARACTERS          ← welke personages, welke tijdversie
[10] SCENE-SPECIFIC STATE      ← world_state + scene_forbidden
[11] SCENE CONTENT             ← Claude-gegenereerde visuele beschrijving
```

Plus optioneel een base64 PNG als referentie-afbeelding (de style proof / kalibratie).

---

## Compositiesysteem

### Principe: narratief gestuurd, stijl-uitgevoerd

Compositie en stijl zijn twee onafhankelijke assen:

- **Compositie** — narratieve beslissing: wat vraagt *dit moment* visueel? Claude kiest op basis van de scène-inhoud en emotionele lading.
- **Stijl-executie** — hoe voert *deze tekenaar* die compositie uit? Vastgelegd in het `COMPOSITION EXECUTION`-blok per stripstijl in `strip_styles.js`.

### `composition_directive` — alle modi (A, B, C)

Claude genereert bij elke scène een `composition_directive` als veld in het scene-JSON. Dit is vrije tekst, geen vocab-label:

```json
"composition_directive": "extreme low angle wide shot, tiny figures dwarfed by sea overhead, diagonal tension left to right"
```

De directive combineert vier elementen:
- **Camerastandpunt** — eye-level / low angle / bird's eye / dutch angle / worm's eye
- **Shot-grootte** — extreme close-up / close-up / medium shot / wide shot / extreme wide
- **Figuur-ruimte-verhouding** — figuur vult kader / kleine figuur in grote omgeving
- **Compositie-energie** — statisch / diagonaal / radiaal / horizontale rust

**Leidraad die Claude meekrijgt:**

| Narratief moment | Compositorische richting |
|---|---|
| Actie, conflict | Diagonaal of laag standpunt |
| Dialoog, overleg | Medium shot, ooghoogte |
| Schaal, eenzaamheid | Kleine figuur in grote omgeving |
| Emotionele piek | Close-up of extreme close-up |
| Overzicht, situatieschets | Vogelperspectief of breed totaalshot |

### Diversiteit in mode C

Mode C (grafische roman) stuurt Claude expliciet aan op variatie: geen twee panels mogen dezelfde combinatie van camerastandpunt, shot-grootte en energie hebben. De leidraad is narratief — de compositiekeuze volgt het verhaalmoment, niet een rotatiesysteem.

### COMPOSITION EXECUTION in `strip_styles.js`

Elke stripstijl heeft een `COMPOSITION EXECUTION`-blok in zijn `PANELS/FRAMES`-sectie. Dit blok beschrijft hoe de stijl *elke willekeurige compositie-instructie* uitvoert — niet welke composities de stijl oplegt. Voorbeelden:

- **Moebius** — frame ademt altijd; sky of landschap vult minstens de helft van het beeld, ongeacht standpunt
- **Franquin** — diagonaal bij chaos, horizontaal bij rust; camera volgt narratieve functie
- **Noir** — altijd extreem standpunt (kikkerperspectief of overhead); nooit neutraal ooghoogte
- **Retera** — altijd statisch ooghoogte, deadpan frontaal; de absurde situatie krijgt dezelfde visuele onverschilligheid als het gewone

### Backward compatibility

`buildFinalGeminiPrompt` leest `scene.composition_directive` met fallback op het oude `scene.composition_type`, zodat eerder opgeslagen scènes bij herGeneratie niet breken.

---

## Aanbevolen workflow voor een nieuw verhaal

1. **Maak de StoryDef aan** — via "+ Nieuw verhaal" in de bibliotheekkolom of importeer een JSON. Focus op goede `worldRules`: tijd, locatie, technologie, kledingstijl, verboden elementen, atmosfeer.

2. **Genereer het consistentieprofiel** — instellingen → "Genereer profiel". Claude leest het volledige verhaal en schrijft CHARACTER SHEET, SCENE PROPS en CHARACTER APPEARANCE.

3. **Stel de stijl in** — pas de driehoek en realism-slider aan op de sfeer van het verhaal. De `defaultStyle` uit de StoryDef is het startpunt.

4. **Genereer en keur de kalibratie goed** — bij de eerste generatierun verschijnt de karakteropstelling. Keur goed of stuur bij met vrije tekst.

5. **Markeer paragrafen en genereer** — selecteer scènes en kies modus A, B of C.

---

## Voorbeeld-galerie

Knop "◻ Voorbeelden" in de header van de resultatenkolom laadt vooraf gegenereerde afbeeldingen uit de `voorbeeld/`-map als gewone gallery-cards.

**Manifest:** `voorbeeld/index.json` — statisch JSON-bestand met alle series en hun filenames. Nodig omdat GitHub Pages geen directory listings geeft. Handmatig bijhouden bij nieuwe series.

**Werking:**
1. Eerste klik → `fetch('voorbeeld/index.json')` → series gecached in `_exampleSeries`
2. Picker toont serie-knoppen; klik → `outputView.loadExamples(series)`
3. `loadExamples` roept `addImage` aan met `isExample: true` en de URL als `dataUrl`
4. `_makeCard` herkent `isExample` → geen ↺-knop, geen regen-panel; badge "voorbeeld" in header
5. ZIP-download: voorbeeld-URLs worden via `fetch` als base64 opgehaald

**Titel uit bestandsnaam:** `_titleFromFilename(filename)` — slaat fileCode (2 chars), datums, volgnummers en stijlparameters over; eerste resterende segment wordt de titel.

---

## JSON-parsing (generator.js)

Claude's JSON-output bevat soms trailing commas of letterlijke newlines in strings. De parsing-laag in `generator.js` vangt dit op:

```javascript
_sanitizeJson(s)           // trailing commas + newlines/tabs in strings
safeParseJsonArray(raw)    // modus B/C: array van scène-objecten
safeParseJsonObject(raw)   // modus A: enkel scène-object
```

Beide `safe*`-functies proberen eerst `JSON.parse`, dan `JSON.parse(_sanitizeJson(...))`, en loggen de fout bij blijvende mislukking. `safeParseJsonObject` is toegevoegd in v0.043 — modus A gebruikte hiervoor kale `JSON.parse`, wat crashte op trailing commas in complexe verhalen.

---

## Cache-busting (importmap)

ES modules worden door browsers agressief gecached op URL. Om te voorkomen dat gebruikers na een versie-update verouderde modules laden (en handmatig cache moeten clearen, wat ook localStorage wist), gebruikt de app een dynamisch gegenereerde importmap.

**Werking:**

```html
<!-- index.html, onderaan <body> -->
<script>
  (function () {
    const V = '036'; // ← versie-bump hier + ?v= hieronder + generator.js → VERSION
    // ... bouwt importmap op ...
    // Alle /js/*.js en /js/stories/*.js → /js/*.js?v=036
  })();
</script>
<script type="module" src="js/app.js?v=036"></script>
```

De importmap wordt synchroon vóór het module script in de DOM ingevoegd. Daarna laden alle `import`-statements in de module-keten automatisch de versioned URL — de browser haalt altijd de juiste versie op zonder hard reload.

**Bij een versie-bump drie plekken bijwerken** (alle drie in of vlak bij `index.html`):
1. `const V = '036'` in het inline script
2. `?v=036` op de statische `<script type="module">` tag
3. `VERSION = 'v0.036'` in `generator.js` (bepaalt de badge in de UI)

**Gevolg:** API-sleutels (opgeslagen in `localStorage`) gaan nooit verloren door versie-updates — de browser hoeft nooit handmatig gecleard te worden.

---

## Tech stack

- **HTML + CSS + JS** — losse bestanden, geen frameworks, geen build-stap
- **ES modules** (`type="module"`) — `import`/`export` tussen JS-bestanden
- **Lokale server vereist** — `python3 -m http.server 8080` (ES modules werken niet via `file://`)
- **Claude API** — tekstverwerking: scènekeuze, beeldprompts, onderschriften
- **Gemini Image API** — beeldgeneratie (native multimodal output of Imagen 4)
- **localStorage** — persistentie van API-sleutels, stijlinstellingen, markeringen

---

## Bestandsstructuur

```
novelizer/
├── index.html              — HTML-skelet, laadt CSS + JS modules
├── css/
│   └── style.css           — alle styling
└── js/
    ├── story_data.js       — verhaal als data (paragrafen, hoofdstukken) [→ stories/ in multi-story]
    ├── storage.js          — localStorage lezen/schrijven (alle nv_* sleutels)
    ├── api.js              — Claude API + Gemini API calls, foutafhandeling
    ├── widget_triangle.js  — stijldriehoek: SVG, barycentrisch, sliders, numerieke invoer
    ├── story_view.js       — verhaalweergave, zoeken, markeren, §-nummers
    ├── generator.js        — generatiepipeline (A/B/C), prompt-opbouw, events
    ├── output.js           — resultaatweergave, galerij, download PNG/ZIP, regeneratie
    ├── strip_styles.js     — definities van stripstijl-overlays
    ├── style_defs.js       — stijlmix-definities (Gouden Eeuw, Jugendstil, Magisch Realisme)
    └── app.js              — initialisatie, event-wiring, instellingen-modal
```

### Verantwoordelijkheden per bestand (v0.028)

`story_data.js` — alleen data, geen DOM. Exporteert `STORY` (paragrafen, hoofdstukken). In de multi-story target: opgegaan in `stories/bordewijk_verplaatsing.js` als `StoryDef`.

`storage.js` — één centrale plek voor alle localStorage-toegang. Typed helpers: `getStyle()`, `setStyle()`, `getMarks()`, `setMarks()`, `getConsistency()`, `getStyleProof()` etc.

`api.js` — exporteert `claudeComplete(messages, systemPrompt, signal)` en `geminiGenerateImage(prompt, model, signal, styleProof)`. Haalt API-sleutels op via `storage.js`.

`widget_triangle.js` — volledig zelfstandig SVG-widget. Exporteert `TriangleWidget(containerEl)` met methoden `setWeights(w1, w2, w3)`, `onChange(callback)`.

`story_view.js` — rendert het verhaal in de DOM op basis van `STORY`. Beheert zoeken, §-klik/sleep-selectie, markering-opslag en segmentering.

`generator.js` — importeert `api.js` en `story_data.js`. Bouwt prompts op, coördineert generatievolgorde, emits events per fase. Bevat ook `regenerateScene()` voor per-afbeelding herGeneratie en `generateStripStyleTest()` / `generateStyleTest()`.

`output.js` — luistert naar generator-events, rendert afbeeldingen (modi A/B/C), regelt download PNG/ZIP, lightbox, regeneratie-paneel per kaart, karakterreferentie-card met goedkeuringsflow.

`app.js` — importeert alles, initialiseert bij `DOMContentLoaded`, koppelt alle UI-events aan modules.

---

## Dataflow per modus

### Modus A — Eén illustratie

```
Gebruiker selecteert paragraaf/tekst
  → Claude: genereer visuele beschrijving + Gemini-beeldprompt
      (stijlgewichten + realismewaarde meegeven als instructie)
  → Gemini: genereer PNG (1024×1024)
  → Toon afbeelding + optioneel onderschrift
  → Download-knop
```

### Modus B — Kleine reeks (3–5 afbeeldingen)

```
Gebruiker kiest: automatisch of handmatig scènes selecteren
  → [automatisch] Claude: analyseer verhaal, kies 3–5 visueel rijke momenten
  → [handmatig] gebruiker markeert paragrafen in de tekst
  → Per scène: zelfde flow als Modus A
  → Genereer één voor één OF in batch (parallel fetch)
  → Galerij-weergave met download per afbeelding
```

### Modus C — Grafische roman (6–12 afbeeldingen)

```
Gebruiker kiest aantal afbeeldingen (6 / 9 / 12)
  → Claude: verdeel verhaal in N segmenten, geef per segment:
      - scènetitel
      - visuele beschrijving
      - maximaal 35 woorden voor evt. tekstballon/onderschrift
      - Gemini-beeldprompt (stijlgewichten verwerkt)
  → Per panel: Gemini genereert PNG (832×1216 portret)
  → Weergave als grafische-romanpagina's (CSS grid, 2 panels/rij)
  → Optie: met onderschrift / met tekstballon / zonder tekst
  → Download per panel of als ZIP
```

---

## API-integratie details

### Claude API

Endpoint: `https://api.anthropic.com/v1/messages`
Model: `claude-sonnet-4-20250514`
Headers: `x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access: true`

Taken:
1. Scèneselectie (JSON-output: array van paragraaf-IDs + visuele beschrijving)
2. Beeldpromptgeneratie (per scène, stijlgewichten als parameter)
3. Onderschriftgeneratie (optioneel, citeert/parafraseert originele tekst)

### Gemini Image API — twee smaken

**Optie 1: Gemini Flash native image output (gratis, ontwikkeling)**
```
POST https://generativelanguage.googleapis.com/v1beta/models/
     gemini-2.0-flash-preview-image-generation:generateContent?key={KEY}
Body: {
  contents: [{ parts: [{ text: PROMPT }] }],
  generationConfig: { responseModalities: ["IMAGE"] }
}
Response: content[].parts[].inlineData.data (base64 PNG)
```

**Optie 2: Imagen 4 Fast (betaald, productie)**
```
POST https://generativelanguage.googleapis.com/v1beta/models/
     imagen-4.0-fast-generate-001:predict?key={KEY}
Body: {
  instances: [{ prompt: PROMPT }],
  parameters: { sampleCount: 1 }
}
Response: predictions[].bytesBase64Encoded (PNG)
```

Modelkeuze instelbaar in de app (dropdown in instellingen), standaard gratis model.

---

## Stijlsysteem — drie lagen en hun interactie

De visuele stijl bestaat uit drie onafhankelijke inputs die in `buildFinalGeminiPrompt()` worden gecombineerd. Elk heeft een afgebakende semantische rol; hun samenspel bepaalt hoe de uiteindelijke Gemini-prompt eruitziet.

### De drie inputs

| Input | UI-element | Semantische rol | Altijd aanwezig? |
|---|---|---|---|
| **Stijlmix** | Driehoekwidget (barycentrisch) | Artistieke toon: kleurpalet, sfeer, compositiefilosofie, kunststroming-referenties | Ja |
| **Uitvoering** | Realisme-slider (0–100) | Basis rendering-fidelity: illustratief ↔ fotorealistisch | Ja |
| **Stripstijl-invloed** | Dropdown (optioneel) | Rendering-techniek overlay: lijntechniek, kleurapplicatie, paneelconventies | Nee |

**Stijlmix** bepaalt *wat* de wereld eruitziet en aanvoelt — kleuren, sfeer, compositie-esthetiek. Altijd aanwezig, ongeacht uitvoering of stripstijl.

```
w1 = Gouden Eeuw / 17e-eeuwse Nederlandse schilderkunst  (0.0 – 1.0)
w2 = Jugendstil / Art Déco                               (0.0 – 1.0)
w3 = Magisch Realisme                                    (0.0 – 1.0)
w1 + w2 + w3 = 1.0  (barycentrisch, genormaliseerd)
```

Numerieke invoer naast de driehoek zodat exacte waarden direct ingevoerd kunnen worden.

**Uitvoering** (`realism`) bepaalt de basis rendering-fidelity:

```
0   → flat grafisch (zero shading, zero gradients, bold outlines)
25  → illustratief (expressieve lijnen, simpele toonvariatie)
50  → semi-realistisch (gedetailleerde schildertechniek, natural lighting)
75  → realistisch (accurate anatomie, natural light, finished illustration)
100 → fotografisch (strikte medium-override: dit is een FOTO)
```

**Stripstijl-invloed** voegt een rendering-techniek overlay toe. De **sterkte** van die overlay schaalt **omgekeerd met uitvoering** — dit is het kernprincipe:

- Uitvoering laag (illustratief) → stripstijl dominant, bepaalt het medium
- Uitvoering hoog (realistisch/foto) → stripstijl subtiel, is een smaakje

### Autoriteits-hiërarchie per uitvoerings-niveau

Wanneer een stripstijl actief is:

```
Uitvoering  Rol van de stripstijl
──────────  ──────────────────────────────────────────────────────────────
0           Stripstijl IS het medium — volledig dominant
25          Stripstijl dominant; uitvoering-niveau voegt detail toe
50          Stripstijl en uitvoering delen autoriteit; beide zichtbaar
75          Uitvoering dominant; stripstijl als duidelijk esthetisch kader
76–99       Uitvoering/foto primair; stripstijl = minimale smaak
100         Fotografisch override; stripstijl = subtiele sfeer
```

De stijlmix behoudt zijn rol (kleurpalet, sfeer, compositie) op elk niveau — alleen de rendering-techniek-autoriteit wisselt.

### Interactiematrix

| Uitvoering \ Stripstijl | Geen stripstijl | Stripstijl aanwezig |
|---|---|---|
| **0** (flat) | Stijlmix-palet, pure flat grafiek | Comic-rendering volledig; stijlmix kleurt palet |
| **25** (illustratief) | Stijlmix-palet, expressief illustratief | Comic dominant + uitvoering-detail; stijlmix kleurt palet |
| **50** (semi-realistisch) | Stijlmix-palet, semi-realistisch | Comic als framework + realistisch volume; stijlmix kleurt palet |
| **75** (realistisch) | Stijlmix-palet, realistisch schilderwerk | Realistisch + duidelijke comic esthetiek; stijlmix kleurt palet |
| **100** (foto) | Fotorealistisch (stijlmix = world design) | Fotorealistisch; stripstijl = subtiel smaakje |

### Promptopbouw — volgorde en autoriteit

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [1] ART STYLE block                       ← stijlmix output           │
│       Rol: kleurpalet, sfeer, compositie, kunststroming-referenties     │
│       Altijd aanwezig (bij realism=100 hernoemd naar WORLD DESIGN)      │
├─────────────────────────────────────────────────────────────────────────┤
│  [2] RENDERING AUTHORITY bridge note       ← wanneer stripstijl actief │
│       Rol: verduidelijkt relatie ART STYLE ↔ COMIC BOOK RENDERING      │
│       Tekst en autoriteit schalen met uitvoering:                       │
│                                                                         │
│       realism 0–25   → "ART STYLE = palet/sfeer only.                  │
│                          COMIC BOOK RENDERING IS het medium."           │
│       realism 26–50  → "Comic dominant; uitvoering voegt volume."       │
│       realism 51–75  → "Realistisch primair; comic als esthetisch kader"│
│       realism 76–99  → "Realistisch/foto primair; comic = smaakje"      │
├─────────────────────────────────────────────────────────────────────────┤
│  [3] FIDELITY LEVEL                        ← hernoemd RENDERING-blok   │
│       Wanneer: stripstijl actief + realism < 100                        │
│       Label schaalt met uitvoering:                                      │
│       0–25  → "FIDELITY LEVEL (fully overridden by COMIC BOOK...)"      │
│       26–50 → "FIDELITY LEVEL (strongly shaped by COMIC BOOK...)"       │
│       51–75 → "FIDELITY LEVEL (partially moderated by COMIC BOOK...)"   │
│       76–99 → "FIDELITY LEVEL (lightly flavored by COMIC BOOK...)"      │
├─────────────────────────────────────────────────────────────────────────┤
│  [4] COMIC BOOK RENDERING block            ← stripstijl definitie      │
│       Wanneer: stripstijl actief                                         │
│       Rol: lijntechniek, kleurapplicatie, paneelconventies              │
├─────────────────────────────────────────────────────────────────────────┤
│  [5] WORLD RULES                           (altijd)                     │
│  [6] CHARACTER SHEET + WORLD CONTEXT       (altijd)                     │
│  [7] COMPOSITION directive                 (Mode C only)                │
│  [8] SCENE CONTENT                         (altijd)                     │
│  [9] TEXT-instructie                       (ballon / charLabels / geen) │
└─────────────────────────────────────────────────────────────────────────┘

Bijzonder geval realism = 100 — volgorde wijzigt:
  [0] RENDERING MEDIUM override vóór alles: "This image is a PHOTOGRAPH"
      ART STYLE hernoemd naar WORLD DESIGN LANGUAGE
      Geen FIDELITY LEVEL rename, geen COMIC BOOK RENDERING block
```

---

## Persistentie (localStorage)

| Sleutel | Inhoud |
|---|---|
| `nv_key_claude` | Claude API-sleutel |
| `nv_key_gemini` | Gemini API-sleutel |
| `nv_model_gemini` | Gekozen Gemini-model |
| `nv_style` | `{w1, w2, w3, realism}` |
| `nv_marks` | Array van gemarkeerde paragraaf-IDs |
| `nv_seg_bounds` | Array van paragraaf-IDs met een segmentgrens erna |
| `nv_intra_splits` | Object `{ [paraId]: sentenceIndex }` — intra-§-splitsingen |
| `nv_mode` | Laatste gekozen modus (A/B/C) |
| `nv_novel_count` | Laatste gekozen aantal panels (C) |
| `nv_text_opts` | Tekstweergave-opties (ballon/onderschrift/geen) |
| `nv_consistency` | Gecached consistentieprofiel (Engels, plaintext) |
| `nv_style_proof` | Base64 PNG van de referentieafbeelding (stijlproef) |

---

## Afbeeldingsformaten en panelafmetingen

### Enkelbeld & kleine reeks
- **1024×1024px** vierkant — universeel, makkelijk schaalbaar

### Grafische roman — portretpanelen
- **832×1216px** (~10:14,5 ratio) — past bij standaard comicpage-ratio (6.625"×10.25")
- Weergave op scherm: 2 kolommen CSS grid, max-width per panel ~380px
- Gutter tussen panels: 8px (compact) of 16px (luchtig), instelbaar

### Panelindelingen grafische roman
| Aantal panels | Rijen × kolommen | Opmerking |
|---|---|---|
| 6 | 3 rijen × 2 kolommen | Ruim, klassiek Europees album |
| 9 | 3 rijen × 3 kolommen (of 4+3+2) | Meest voorkomend in strips |
| 12 | 4 rijen × 3 kolommen | Dicht, manga-achtig |

Elke "pagina" in de browser = 1 rij (2–3 panels naast elkaar).
Volledige reeks scrollt verticaal.

---

## Consistentiesysteem

### Doel
Alle gegenereerde afbeeldingen moeten consistent zijn in:
1. **Personages** — uiterlijk van Bordemanse en Drebbel is stabiel over alle afbeeldingen
2. **Wereldstaat per fase** — de fysieke werkelijkheid is afhankelijk van waar in het verhaal de scène zich afspeelt
3. **Visuele stijl** — kleurpalet en tekenstijl verankerd aan de eerste afbeelding

### Twee-laags consistentie

Het verhaal heeft meerdere wereld-staten. Een illustratie bij §10 (vóór de verplaatsing)
toont een normale zee. Een illustratie bij §47 toont de droge zeebodem met groene waterhemel.
Daarom bestaat het consistentiesysteem uit twee onafhankelijke lagen:

**Laag 1 — CHARACTER SHEET (globaal, gecached)**
Gegenereerd door Prompt 0, opgeslagen in `nv_consistency`.
Bevat uitsluitend personagebeschrijvingen en globale FORBIDDEN-lijst.
Geen wereldregels — die zijn fase-afhankelijk.

**Laag 2 — WORLD STATE (fase-afhankelijk, uit WORLD_CONTEXT.md)**
Bepaald door het `phase`-veld dat bij elke scèneselectie (Prompt 1/2/3) wordt teruggegeven.
Fase-waarden: `pre-event` | `rising` | `post-event-shore` | `seabed-journey` |
`french-village` | `alderney-murder` | `2006`

De bijbehorende wereld-staat wordt opgehaald uit **WORLD_CONTEXT.md** sectie 4.
Zie PROMPTS.md voor de volledige fase → context mapping.

### WORLD_CONTEXT.md

Bevat de complete "illustrators-bijbel":
- Bordewijks schrijfstijl vertaald naar visuele regels
- Gedetailleerde personagebeschrijvingen
- De verhaalchronologie met wereld-staat per fase (wat is er al/nog niet gebeurd)
- Visueel vocabulaire (waterplaat, waterkolommen, champagneglazen, lichtgaten)
- Snelle naslaginformatie: paragraafnummer → fase → wereld-staat

### Promptstructuur per afbeelding

```
{CHARACTER_SHEET}           ← uit nv_consistency (Prompt 0)

{WORLD_STATE_CONTEXT}       ← uit WORLD_CONTEXT.md, sectie 4, fase-specifiek

SCENE:
{CLAUDE_GENERATED_SCENE_PROMPT}   ← Prompt 4 output

Style emphasis: {DOMINANT_STYLE}
Color palette: {PALETTE}
Technical: {REALISM_TERMS}
No text, no lettering, no speech bubbles in the image.
```

### Karakterreferentie als visueel anker

Vóór de scène-generatie genereert Gemini een **karakterreferentie-afbeelding**: alle hoofdpersonages staand naast elkaar, full-body, neutrale achtergrond. Deze afbeelding:

- Wordt automatisch opgeslagen als `nv_style_proof` in localStorage
- Wordt bij alle volgende Gemini-calls meegestuurd als referentie-image (`parts` naast de tekstprompt)
- Is zichtbaar als "Karakterreferentie ✦"-kaart bovenaan de output

**Goedkeuringsflow**: de generator pauzeert na de karakterreferentie en wacht op een Promise. De kaart toont "✓ Goedkeuren" en "↺ Opnieuw genereren" (met optioneel tekstveld voor bijsturing). Pas na goedkeuring vervolgt de scène-generatie.

### localStorage-sleutels (huidig)

| Sleutel | Inhoud |
|---|---|
| `nv_consistency` | Gecached consistentieprofiel (Engels, plaintext) |
| `nv_char_appearances` | Geëxtraheerde CHARACTER APPEARANCE secties |
| `nv_style_proof` | Base64 PNG van de karakterreferentie |

### UI-elementen

In de instellingen-modal:
- Knop **"Genereer consistentieprofiel"** — handmatig (her)aanmaken via Claude
- Indicatie of een profiel aanwezig is (datum/tijd van aanmaak)
- Knop **"Wis consistentieprofiel"** — verwijdert profiel + char appearances

In de output-sectie:
- Karakterreferentie-kaart met goedkeurings-UI (vóór scène-generatie)
- Per verhaalkaart: ↺-knop opent inline regeneratie-paneel met optioneel bijsturingsveld

---

## Segmentsysteem (experimenteel)

Paragrafen kunnen worden samengevoegd of opgesplitst voor beeldgeneratie. Dit systeem werkt op drie niveaus:

### 1. Tussen-paragraaf-grenzen (`nv_seg_bounds`)

Een **grens** op positie N betekent: er zit een segmentwisseling *na* paragraaf N (voor de eerstvolgende gemarkeerde § na N). N is altijd een gemarkeerd paragraaf-ID.

- **Standaard bij markeren**: §N krijgt een grens na de vorige gemarkeerde § en na §N zelf → elke paragraaf is zijn eigen segment.
- **Samenvoegen**: verwijder een grens → de twee groepen worden één segment (tekst van beide §§, zonder ongemarkeerde §§ ertussen).
- **Herscheiden**: voeg een grens terug toe.

Niet-aangrenzende gemarkeerde paragrafen (bijv. §3 en §7) kunnen worden samengevoegd. De tussenliggende ongemarkeerde §§ (4–6) worden dan overgeslagen in de scènetekst.

### 2. Intra-paragraaf-splitsingen (`nv_intra_splits`)

Formaat: `{ [paraId]: sentenceIndex }` — splitsing na zin `sentenceIndex` (0-gebaseerd).

Een paragraaf met een intra-split levert **twee segmenten** op: eerste helft en tweede helft. Kan niet tegelijk worden samengevoegd met buurparagrafen.

**Touch-interactie**: 500 ms long press op een gemarkeerde § → versleepbare `− − −` splitser verschijnt. Vinger omhoog/omlaag verplaatst de splitser naar zinsgrenzen. Loslaten = bevestigen.

Tijdens de drag wordt een **non-passive touchmove-handler** dynamisch attached om scrollen te blokkeren, en na touchend weer verwijderd.

### 3. `_computeSegments()` output

```javascript
[
  { paras: [3, 7] },                            // samengevoegd
  { paras: [5], textSlice: 'first',  splitAt: 1 }, // eerste helft van §5
  { paras: [5], textSlice: 'second', splitAt: 1 }, // tweede helft van §5
]
```

`generator.js` gebruikt `getSegmentText(seg)` om de juiste tekst per segment op te halen.

### UI-elementen in de verhaalkolom

| Element | Klasse | Wanneer |
|---|---|---|
| Scheiding tussen aangrenzende §§ | `.seg-between.is-split` | Grens aanwezig — toont `−` |
| Samenvoeging aangrenzende §§ | `.seg-between.is-merged` | Geen grens — toont `+` |
| Bovenkap per segment | `.seg-cap.seg-cap-top` | Boven eerste § van een segment |
| Onderkap per segment | `.seg-cap.seg-cap-bottom` | Onder laatste § van een segment |
| Intra-splitser | `.seg-intra-marker` | Na bevestigde long-press split |
| Drag-indicator | `.seg-intra-drag` | Tijdens actieve long-press drag |

---

## Generatiestrategie

- **Eén voor één**: elke afbeelding na de vorige, progress-indicator per panel
- **Batch**: alle fetch()-calls tegelijk (Promise.all), sneller maar meer API-load
- Gebruiker kiest via toggle; standaard: één voor één (overzichtelijker bij fouten)

---

## Foutafhandeling

- API-fout → toon foutmelding per panel, rest gaat door
- Rate limit Gemini gratis tier (500/dag) → duidelijke melding + suggestie betaald model
- Ontbrekende API-sleutel → modal met instructie, focus op invoerveld

---

## Ontwikkelingstips

**Server starten:**
```bash
cd /DATA/04_projects/bordewijk
python3 -m http.server 8080
# open http://localhost:8080
```
Claude Code kan dit als achtergrondproces starten en de browser openen.

**Overige tips:**
- API-sleutels leven in localStorage — eenmalig invoeren, persistent over herladen
- `storage.js` is de enige plek waar localStorage wordt aangeraakt — makkelijk te debuggen
- `console.log` in `generator.js` toont alle gegenereerde prompts (voor tuning)
- Gebruik `?dev=1` URL-parameter om een debug-paneel te tonen (raw prompts, API-responses)
- Gratis Gemini-model heeft lagere beeldkwaliteit dan Imagen 4, maar prima voor stijlproeven
- Bij het bouwen: begin met `story_data.js` → `storage.js` → `api.js` (geen DOM-afhankelijkheden), daarna de UI-modules
