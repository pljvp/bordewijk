# Novelizer

Interactieve webapplicatie die literaire teksten omzet naar illustraties en grafische romans, met behulp van de Claude API (Anthropic) en de Gemini Image API (Google).

Standaardverhaal: *Verplaatsing van elementen* — F. Bordewijk (1956).

Zie `ARCHITECTURE.md` voor de technische dataflow en de informatiepipeline.

---

## Snel starten

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

ES modules werken niet via `file://` — een lokale server is vereist. Bij eerste gebruik: voer API-sleutels in via het tandwiel-icoon rechts bovenin.

---

## API-sleutels

| Dienst | Waarvoor | Aanvragen |
|---|---|---|
| Anthropic Claude | Verhaalanalyse, scènekeuze, prompt- en bijschriftgeneratie | [console.anthropic.com](https://console.anthropic.com) |
| Google Gemini | Beeldgeneratie | [aistudio.google.com](https://aistudio.google.com) |

Sleutels worden opgeslagen in `localStorage` en verlaten de browser nooit — alle API-calls gaan rechtstreeks vanuit de browser.

---

## Beeldgeneratiemodellen

| Model | Kosten | Gebruik |
|---|---|---|
| `gemini-3.1-flash-image-preview` | Gratis preview | Ontwikkeling & stijlproeven — **aanbevolen** |
| `imagen-4.0-fast-generate-001` | ~$0,02/afbeelding | Productie, hogere kwaliteit |
| `imagen-4.0-generate-001` | ~$0,04/afbeelding | Maximale kwaliteit |

Kiesbaar via de instellingen-modal. Standaard: het gratis Flash-model. Gegenereerde afbeeldingen zijn vierkant (formaat bepaald door het model).

---

## Verhaalbibliotheek

De meest linkse kolom toont alle beschikbare verhalen. De bibliotheek bevat nu twee verhalen:

| Verhaal | Auteur | Code |
|---|---|---|
| Verplaatsing van elementen | F. Bordewijk | `VE` |
| De Saga van Bolifur de Paling | Anoniem | `BS` |

Klik op een kaart om van verhaal te wisselen. Alle opgeslagen data (consistentieprofiel, markeringen, stijlproef) is per verhaal gescheiden.

### Nieuw verhaal toevoegen

1. Klik **+ Nieuw verhaal** onderaan de bibliotheekkolom
2. Plak de verhaaltekst in het tekstvlak
3. Klik **Genereer storydata (Claude)** — Claude extraheert titel, auteur, hoofdstukken, alinea's, schrijfstijl en een eerste set wereldregels
4. Exporteer als JSON voor hergebruik, of klik weg
5. Verfijn de **wereldregels** in de instellingen-modal voor betere beeldkwaliteit

Bij `?dev=1` in de URL verschijnt de knop **"📋 Print als JS"** — formatteert de StoryDef als kant-en-klaar JS-module voor `js/stories/` (print naar console + klembord).

---

## Generatiemodi

### Modus A — Eén illustratie
Eén afbeelding voor de geselecteerde paragraaf of een door Claude gekozen dramatisch hoogtepunt.

### Modus B — Kleine reeks
Claude kiest 2–8 visueel rijke scènes, of de gebruiker markeert paragrafen. Weergave als galerij.

#### Segmenten
Bij handmatige paragraafkeuze kun je grenzen aanpassen:
- **`−`** tussen twee paragrafen → samenvoegen tot één afbeelding
- **`+`** → weer splitsen
- **Lang indrukken** op een paragraaf → interne splitser slepen → één paragraaf levert twee afbeeldingen

### Modus C — Grafische roman
Claude verdeelt het verhaal in 1–18 panelen, elk met scènetitel, visuele beschrijving en bijschrift. Weergave als scrollend strip-album.

---

## Stijlsysteem

Drie lagen die samen de visuele stijl bepalen.

### Stijldriehoek

Interactieve barycentrische SVG-widget. Sleep het punt of voer de gewichten numeriek in.

```
         Jugendstil / Art Déco
         (Mucha, Klimt, De Lempicka)
                  △
                 /|\
                / ● \   ← versleepbaar
               /     \
              △───────△
    Gouden Eeuw     Magisch Realisme
  (Van Ruisdael,   (Carel Willink,
   Rembrandt)       de Chirico, Magritte)
```

- **w1 — Gouden Eeuw**: 17e-eeuwse Nederlandse schilderkunst. Ruisdael-luchten, Rembrandt-licht, impasto, amberwarme tonen.
- **w2 — Jugendstil / Art Déco**: S-curven (Mucha), geometrische vlakken (De Lempicka), goud en diep teal, siersvormen als fundamentele morfologie.
- **w3 — Magisch Realisme**: Hyper-precise techniek (Willink), vervreemdende stilte, scherpe diagonale schaduwen, ijskoude Nederlandse plaatsen — herkenbaar reëel, maar net niet.

**w1 + w2 + w3 = 1,0** (automatisch genormaliseerd).

### Uitvoering (realisme-slider)

Schaal 0–100: van flat grafisch (0) via illustratief (25) en semi-realistisch (50) tot fotografisch (100).

### Stripstijl-overlay

Een rendering-overlay bovenop de stijlmix, die de tekenwijze bepaalt. De invloed is omgekeerd evenredig met de realisme-slider (bij laag realisme dominant, bij hoog realisme subtiel).

| Groep | Stijlen |
|---|---|
| Nederlandse strips | Joost Swarte (NL ligne claire, satirisch) · Mark Retera / DirkJan (absurdistisch-minimaal) |
| Belgisch / Frans | Ligne claire (Hergé / Tintin) · Franquin (Gaston Lagaffe) · Moebius / Jean Giraud |
| Overig | Manga (One Piece / Oda) · Noir / zwart-wit (Eisner) · Underground / Raw (Crumb) |

---

## Consistentie en kalibratie

**Consistentieprofiel** — Claude leest de volledige verhaaltekst en genereert een profiel met CHARACTER SHEET (uiterlijk per personage), SCENE PROPS (objecten-mapping) en CHARACTER APPEARANCE (compacte één-zin beschrijvingen). Dit profiel staat als vaste prefix in elke Gemini-beeldprompt.

**Kalibratie (stijlproef)** — Aan het begin van een run genereert Gemini een karakteropstelling. De gebruiker keurt goed of stuurt bij. De goedgekeurde afbeelding wordt als referentie meegestuurd bij alle volgende Gemini-calls in die run om kleurpalet en stijl consistent te houden.

---

## Exporteren

**PNG per afbeelding** — knop "↓ PNG" op elke afbeeldingskaart.

**ZIP** — na een complete run: knop "Download als ZIP". Bestandsnaam: `{CODE}_{titel}_{datum}_{n}afb.zip`.

**Exporteer met tekst** — knop "↓ Exporteer met tekst": maakt van elke afbeelding een nieuwe PNG via Canvas met scènetitel en bijschrift in een tekstkader eronder (links uitgelijnd, donkere achtergrond). Gedownload als ZIP.

**Bestandsnaamconventie** — `{CODE}_{seq:003}_{YYMMDD}_{HHmm}_{scenetitel}_§{ids}_s{w1}-{w2}-{w3}_r{realism}.png`

Voorbeelden: `VE_001_260525_1430_de-val_§5_s50-30-20_r30.png` · `BS_003_260525_1435_…`

---

## Projectstructuur

```
novelizer/
├── README.md
├── ARCHITECTURE.md
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── stories/
│   │   ├── bordewijk_verplaatsing.js
│   │   ├── bolifur_saga.js
│   │   └── index.js
│   ├── api.js
│   ├── app.js
│   ├── generator.js
│   ├── output.js
│   ├── storage.js
│   ├── story_creator.js
│   ├── story_data.js
│   ├── story_library.js
│   ├── story_view.js
│   ├── strip_styles.js
│   ├── style_defs.js
│   └── widget_triangle.js
└── voorbeeld/
    ├── bolifur_saga.md
    └── de_saga_van_bolifur_de_paling.json
```

---

## Ontwikkelingstips

- Gebruik **`gemini-3.1-flash-image-preview`** tijdens ontwikkeling (gratis, snel)
- `?dev=1` in de URL: debug-paneel met raw prompts + "📋 Print als JS" in de creator-modal
- `storage.js` is de enige plek waar `localStorage` wordt aangeraakt
- ES modules cachen agressief — gebruik **Ctrl+Shift+R** (hard reload) na wijzigingen in `storage.js` of `js/stories/`
- Nieuw verhaal als permanent JS-bestand: aanmaken via creator-modal (`?dev=1`) → "Print als JS" → plak in `js/stories/{id}.js` → registreer in `js/stories/index.js`

---

## Technische stack

- Vanilla **HTML + CSS + JS** — geen frameworks, geen build-stap
- **ES modules** (`type="module"`)
- **Claude API** (`claude-sonnet-4-6`) — analyse, scènekeuze, beeldprompts, bijschriften
- **Gemini Image API** — beeldgeneratie (Flash of Imagen 4)
- **Canvas API** — composite PNG export (tekst + afbeelding)
- **localStorage** — persistentie van sleutels, stijl, markeringen en consistentieprofielen
