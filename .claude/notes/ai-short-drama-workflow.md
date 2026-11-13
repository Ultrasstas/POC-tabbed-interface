# AI short drama workflow (notes from a Higgsfield tutorial transcript the owner supplied)

Source: transcript of "The AI Drama That Doesn't Look Like AI" pasted by the owner. Notes are from the
transcript only; the picture was not seen. The tutorial works in ChatGPT with the Higgsfield plugin; the
same steps apply here, subject to the Higgsfield approval gate in CLAUDE.md.

## Core idea
A 1–3 minute vertical "short drama" that looks like a clip from a real film. Realism is the
differentiator against low-effort AI video. One chat holds the whole project so references keep their names.

## Step 1 — Story people get in seconds
- Pick a familiar situation: (1) Cinderella: someone ordinary gets an unexpected opportunity;
  (2) love against the odds; (3) rivalry: two want the same thing, one can have it.
- Length 1–3 minutes.
- Four parts: **hook → context → escalation → cliffhanger**.
- Needs memorable characters and one clear setting.

## Step 2 — Characters that keep their face
- Face first, with an image model strong at realistic faces (tutorial: Soul 2). Describe the era's
  lighting, colour and film texture so the character already belongs to the world. Reject washed-out faces.
- Name every reference and reuse the exact name all through the chat (LucyFace, LucyOutfit) so an
  older version is never picked up by accident.
- Outfit as a separate reference (described, or from an uploaded image with the details to keep).
- Combine face + outfit into one **character sheet** (tutorial: GPT Image, good at preserving references):
  1. plain **grey** background, not white or black;
  2. three views: full body front, full body back, face close-up;
  3. **erase the face on the full-body front view**, so the video model has exactly one face to follow.
- A changed look (hair down, no glasses) = edit the existing sheet (tutorial: Seedream 5.0), keeping
  face and outfit identical. Do not regenerate from scratch.
- Small details (jewellery): generate a separate close-up and attach it when building the sheet.
- Background extras: generate the whole group in one image (different faces and poses, unified
  wardrobe) and use it as the reference for the scene.

## Step 3 — The whole set in one image
- One location image in **three-quarter view** showing the full layout (where each character sits,
  walks, enters). A straight-on view forces the video model to invent the rest when the angle changes.
- A one-off second location: reuse the main room as a *style* reference and describe the new space
  in the prompt instead of making another location image.

## Step 4 — Script, then generate scene by scene
- Give the outline plus the chosen cast and location; get a scene-by-scene script with dialogue,
  action and a generation prompt per scene (tutorial uses a script skill and a Seedance prompt skill
  for camera/lighting).
- Video model in the tutorial: Seedance 2.5 through Higgsfield.
- **Scene 1 = hook + context.** Open on a glimpse of the loudest moment, without explaining how we
  got there. In the context, keep emotional swings every 20–30 s: starting point → hope → another hit → a chance.
- **Scene 2 = twist/climax.** Build the turn on a feeling everyone recognises (I don't belong, I
  embarrassed myself, I'm in trouble) and flip it into an opportunity.
- **Scene 3 = escalation.** An unexpected turn: new characters, growing conflict. Describe each
  performance separately (her nervous apology; his boredom turning into curiosity) and spell out
  blocking literally (gets up from the red chair, leaves the table, crosses the floor to her).
- Near the end, raise the pace: changing angles, an entrance with anticipation before the face is
  shown, dialogue starting while characters are still moving, small physical interactions, closer framing for reactions.
- **Last scene = cliffhanger** (~10 s): stop right before the answer (a decision, a reveal, a new look), cut to black.

## Reviewing and fixing takes
- Keep what works (acting, camera) and name exactly what to change; update the prompt, regenerate, compare both takes.
- Typical faults: unrealistic or silly action, an empty background where a crowd is needed, a prop
  or person in the wrong place, shots jumping between front and back, long silent pauses, a face
  turned away so the reaction is lost.
- Accents: don't just name the accent; describe how it sounds (e.g. a soft uvular R made at the back of the throat).
- Give each character a voice description and carry it into every scene where they speak; listen to
  takes side by side to check the voices match.

## Monetisation claims made in the video (unverified)
Client work; paid brand integrations; selling access to next episodes by subscription. The view
counts and income figures in the video are the presenter's claims, not checked.
