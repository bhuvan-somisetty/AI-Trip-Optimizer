# Landing page sounds

The landing story mixes these loops by scroll position (see `src/components/landing/journey-sound.ts`):

| File | Scene |
| --- | --- |
| `cabin.mp3` | inside the cabin, at the window |
| `wind.mp3` | out in the clouds |
| `jet.mp3` | the airliner flying alongside |
| `waterfall.mp3` | the gorge and the falls |
| `train.mp3` | the train crossing the bridge |
| `road.mp3` | the coach on the highway |
| `horn.mp3` | one-shot train horn as the bridge comes into view (not looped) |

Add a recording here and list its name (without `.mp3`) in `manifest.json`, for example
`["waterfall", "train", "horn"]`. Any layer without a recording uses a synthesised stand-in.
Loops should be seamless, mono or stereo, 20 to 60 seconds. Only use recordings whose licence allows
use on this site (CC0 or your own), and keep a note of the source.
