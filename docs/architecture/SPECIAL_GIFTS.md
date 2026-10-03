# Special gifts from the teacher: "IDSS Vitrina" (design proposal)

Status: **proposal, waiting for the Director (decisions G1 to G6)** · Sources: Director 2026-10-03 ("nastavnik može
nagraditi učenika sa special gift ... 3D AAA"), PDL-035, mandate §8 (Game Hub, rewards), CONSTITUTION P-4, P-7, P-13,
P-14 · Builds on the WebGL know-how of the splash (PDL-007, PDL-019).

## 1. Idea in one paragraph
A teacher can give a student a **Poseban poklon**: a collectible 3D object with the teacher's personal message engraved
on its base. The student receives it in a short, cinematic **unboxing** on the Game Hub: the four IDSS colours
(#E8262C, #FFCB29, #035EA1, #08ABE6) fly in as the squares and circles of the IDSS logo, assemble the object, light
sweeps over it and the engraving appears. The object then stands in the student's **IDSS Vitrina**, a personal
showcase in 3D that the student can rotate, zoom, view in augmented reality on the own desk (phone) and save as an
image card. It is recognition from a person, never a grade (P-7).

## 2. The gift collection (a fixed catalogue, chosen by the Director)
| Gift | Look | Meant for |
|---|---|---|
| IDSS Kristal | the IDSS logo as a glass and metal cube, colours refracting inside | outstanding effort, any subject |
| Zlatni ikosaedar | a polished golden icosahedron on a dark stone base | Matematika |
| Pero i knjiga | an open book with turning pages and a glowing quill | B/H/S jezik i književnost |
| Schlüssel | an ornate brass key on a velvet cushion | Njemački jezik |
| Upornost | a small mountain whose peak lights up in IDSS yellow | regularity and persistence |
| Iskra | a floating spark in the four IDSS colours | first big step, a comeback |

Six objects are enough to feel special and stay rare; more can be added as data later (G2).

## 3. Experience
1. **Teacher:** on the student profile, **Pošalji poseban poklon**: choose the gift, write a message (up to 200
   characters, P-13 rules apply, checked by `check-app-text` rules at runtime), send. Audited; the message is stored,
   never shown to other students.
2. **Student:** notice (in-app and Web Push, PDL-035) "Imaš poseban poklon od nastavnika". The Game Hub shows a wrapped
   box; a tap starts the unboxing (8 to 10 seconds, skippable at any moment).
3. **Vitrina:** a lit glass shelf with all received gifts; tap one to rotate it, read the engraving (teacher, date,
   message), view in AR, or save a 1080 x 1350 image card in IDSS design.

## 4. "AAA" quality, at zero running cost
- **Rendering:** three.js (WebGL 2), physically based materials (glass transmission, brushed metal, clear-coat),
  image-based lighting from one HDR environment, soft shadows, bloom and depth of field in the unboxing only, tone
  mapping matched to the IDSS palette; 60 fps target on a mid-range phone, adaptive resolution below that.
- **Assets:** six glTF 2.0 models, Draco or meshopt compressed, KTX2 textures, at most 2 MB each, loaded only when the
  gift or the Vitrina opens. Made once by a 3D artist (one-off cost) or from CC0 sources; the engraving is drawn at
  runtime into a texture, so every gift is unique without new models.
- **AR:** the `<model-viewer>` web component: Scene Viewer on Android, Quick Look (USDZ export of each model) on iPhone.
- **Animation:** keyframed in the glTF plus a particle system for the IDSS logo shapes; sound off by default.
- **Fallbacks:** reduced motion: no fly-in, the finished object with a gentle light; no WebGL: a pre-rendered image of
  the same object; screen readers: a text description of the gift and the full message.
- **Hosting:** static files of the app; no paid service, no tracking.

## 5. Rules that keep it fair (P-4, P-7)
A gift never changes a score, readiness or the order of anything. No public ranking, no comparison between students.
Only the student, the giving teacher, the pedagogue, the psychologist and the Director see a student's gifts.

## 6. Decisions for the Director
- **G1 Who gives:** proposal: subject teachers (any of their students) and the Director; pedagogue and psychologist too?
- **G2 Catalogue:** the six gifts above, or another list; the Director approves the final designs before modelling.
- **G3 Limit:** proposal: no automatic limit; the Director sees every gift in the audit. Or a limit per teacher and
  student per month (a number the Director sets).
- **G4 IDSS bodovi for a gift:** proposal: none (a gift is recognition, not points); or a value the Director sets.
- **G5 Sharing:** may the student save and share the image card outside the app? Proposal: yes, without surname.
- **G6 3D models:** a 3D artist for six models (one-off cost, best quality) or CC0 models adapted by us (no cost, less
  unique). The code, the unboxing and the Vitrina are built by us in either case.
