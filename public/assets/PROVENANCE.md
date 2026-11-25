# Astral Fantasy asset provenance

All current portraits, world illustrations, environments, icons, and interface skins are original SVG artwork authored for this project. None embeds a supplied reference image. Reference-derived character WebPs have been removed from the runtime directory and manifest.

- Characters and expressions: `tools/art/original_characters.py`; see `ORIGINAL_ART.md` for designs and verification.
- Environments, world props, materials, and icons: `tools/art/build_assets.py`; deterministic original gradients, line art, grain, and lighting. This script invokes the original character builder and no longer extracts reference characters.
- Interface pack: `src/ui/kit/materials.ts`, `src/ui/kit/skin.css`, and `public/assets/uikit/`; eight shapes in pearl, jade, and midnight finishes. Its README documents geometry, materials, and rebuilding.
- Fonts: locally hosted Cinzel, Lora, and Inter under SIL Open Font License 1.1; full license text in `fonts/`.
- Supplied JPEGs are composition/material references only and remain outside runtime assets.
- Visual review renders live in `tools/art/`; preview PNGs are not needed by gameplay.

The character artwork is editable, anime-influenced vector illustration. Facial-expression variants change actual eyes, eyebrows, and mouth contours.
