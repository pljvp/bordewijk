# Stijldefinities — de drie hoekpunten van de driehoek

De stijldriehoek heeft drie hoekpunten. De gebruiker bepaalt via barycentryczne coördinaten welke mix van de drie stijlen gebruikt wordt. Elke stijl heeft een `full`-definitie (voor dominant gebruik, ≥85%) en een `accent`-definitie (voor secundair gebruik bij hybride mixen).

Zie `wonderkrik/js/style_defs.js` voor de exacte promptteksten.

---

## w1 — Gouden Eeuw (linksonder, amber)

**Label:** 17e-eeuwse Nederlandse schilderkunst
**Kleur in widget:** `#b87c32`

Gebaseerd op de grootmeesters van de Hollandse schilderkunst: landschappen in de trant van Jacob van Ruisdael, Meindert Hobbema en Aelbert Cuyp; portretten in de trant van Rembrandt van Rijn en Frans Hals.

### Visuele kenmerken

**Landschap:**
- Lage horizon: 1/4 tot 1/3 van het kader — de lucht is het onderwerp
- Dramatische cumulusformaties met interne luminositeit; Van Ruisdaels grijsstormlicht
- Cuyps warme gouden middagdunst boven de polder
- Hollands landschap: wijde vlakke polders, kerktorens in de verte, windmolensilhouetten, trage kanalen, geknotte wilgen, onverharde paden
- Atmosferische perspectief: de achtergrond vervaagt naar bleekblauwgrijs

**De zee als waterhemel (wanneer relevant):**
Geschilderd exact zoals Van Ruisdael een stormlucht schilderde: een enorme donkere massa, diep Pruisischblauwgroen, die het bovenste deel van het kader vult. Stralen gebroken goud licht breken erdoorheen als zon door stormwolken, en werpen verschuivende lichtbanen over het vlakke land.

**Portret:**
- Driekwart-pose, psychologisch aanwezige blik — individueel, niet-geïdealiseerd
- Gewone 1950s-werkkleding in Rembrandts techniek: donkere tonen, subtiele sfumato, gezicht oprijzend uit warme bruine schaduw
- Frans Hals' spontane gestische penseelstreek in handen en stof

**Verfkwaliteit:**
Olieverf op doek of eikenhouten paneel. Krachtig penseelwerk op hooglichten (zichtbaar impasto). Dunne transparante glazuren in schaduwpartijen. Verniskleur verschuift alle tinten richting amberbronsgoud.

**Palet:**
Omber, gebrand sienna, ivoor wit, Pruisischblauw, warme oker, bijnaazwart. Het specifieke Hollands grijswit van de lucht. Geen moderne primaire kleuren.

**Absoluut verboden:**
Steampunk-machines, fantastische apparatuur, anachronistische technologie. De TECHNIEK is 17e-eeuws; de SETTING is 1950s Nederland.

---

## w2 — Jugendstil / Art Déco (top, blauw)

**Label:** Jugendstil / Art Déco
**Kleur in widget:** `#4f8dc1`

Een fusie van de organische morfologie van het Jugendstil en de geometrische vereenvoudiging van de Art Déco. De stijl beheerst de vorm van elk element — niet als toegevoegde decoratie, maar als fundamentele morfologie.

### Visuele kenmerken

**Vormen en silhouetten:**
Alle objecten, meubels, voertuigen en architectuur hebben sinueuze S-curve-contouren (Jugendstil) gecombineerd met geometrische vereenvoudiging (Art Déco). Een stoel heeft organisch gebogen poten én hoekige getrappte rugpanelen. Wanden buigen licht als levende wezens. Rechte lijnen bestaan bijna niet.

**Menselijke figuren:**
Mucha-achtige verlengde proporties — lange nekken, sierlijke ledematen. Tamara de Lempicka-invloed: lichamen in gladde geometrische vlakken, gezichten hoekig en dramatisch, sterke licht-schaduw-contrasten.

**Kleding en mode:**
Art Nouveau vliedende gewaden met sinueuze zomen, OF scherp-geschouderde Art Déco-sneden met geometrische patronen (chevrons, zonnestralen, getrappte zigzags) in het weefsel. Haar gestyled in Mucha-golvend of Déco-gladde gebeeldhouwde vormen.

**Palet:**
Goudblad, diep teal, stoffig mauve, ivoor crème, bordeaux, warme amber — geen pure primaire kleuren, geen ontkleurde grijzen.

**Uitvoering:**
Vlakke kleurvlakken begrensd door elegante contourlijnen (niet de brede comicoutline — verfijnd, variabele lijndikte). Oppervlakken hebben patronen als textuur (Klimt-mozaïek of Déco-geometrie) in plaats van fotografische schaduw.

---

## w3 — Retro-SF (rechtsonder, koraal)

**Label:** Retro-SF
**Kleur in widget:** `#e8594a`

Omsleillustraties van Amerikaanse sciencefiction-pulptijdschriften, 1945–1965. Fysieke gouache of olieverf op illustratiebord, gephotografeerd voor druk.

### Visuele kenmerken

**Kunstenaars en publicaties:**
- Ed Emshwiller (Emsh) — elegante chromefiguren, schone dramatische verlichting
- Chesley Bonestell — fotorealistische astronomische grootsheid, precieze structuren
- Richard Powers — abstract-expressionistische SF-texturen, organische vormen
- Frank Kelly Freas — warme humanistische figuren
- Tijdschriften: Galaxy Science Fiction, Amazing Stories, Astounding/Analog

**Kleur:**
Verzadigd offset-litho-palet: cadmiumoranje, chromezilver, cerulean blauw, cadmiumrood, titaniumwit, ruwe sienna. De "atoomtijd": schoon, optimistisch, licht gebleekt door de druk.

**Compositie:**
Krachtige diagonaal. Enkelvoudige gerichte verlichting van links- of rechtsboven. Expliciete slagschaduwen. Kleine menselijke figuren tegenover enorme structuren — gevoel van monumentale schaal.

**Medium:**
Zichtbaar penseelwerk, oppervlaktestructuur, halftoonrasterpunt-patroon van offsetdruk. Geen CGI-gladheid, geen 3D-rendering, geen moderne concept art-airbrushing.

---

## Hybride mixen

De generator combineert stijlen op basis van de driehoekgewichten:

| Situatie | Resultaat |
|---|---|
| Één stijl ≥ 85% | Alleen die stijl, volledig `full`-blok |
| Dominante stijl < 85%, geen secundaire ≥ 15% | Dominante stijl met `full`-blok, lichte dominantie-aanduiding |
| Dominante stijl + één of meer secundaire ≥ 15% | Hybride: `full` voor dominant, `accent` strings voor secundairen |

Bovenop de stijlmix kan een stripstijl-overlay worden toegevoegd (zie STYLE_STRIP.md).
