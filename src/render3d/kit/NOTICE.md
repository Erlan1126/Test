# 3D models

The `.glb` files here are free, public-domain art (CC0 1.0: free for commercial use, no
credit required; we credit anyway):

- `building_*`, `skyscraper_*`: Kenney, City Kit (Commercial) 2.1, https://kenney.nl/assets/city-kit-commercial
  (optimized copies from the npm package `@netforge/asset-library-files` 0.2.0, whose NOTICE
  records each pack's CC0 licence)
- `building_small_*`: Kenney, from Kenney's "Starter Kit City Builder"
  (https://github.com/KenneyNL/Starter-Kit-City-Builder), models CC0; texture embedded
- `tree_*`, `bush*`, `flower_*`, `rock_*`, `stump`, `fence`: Kenney Nature Kit / Quaternius, CC0 1.0,
  via `@netforge/asset-library-files`
- `sedan`, `taxi`, `suv`, `van`, `police_car`, `hatchback_sports`, `delivery_van`: Kenney Car Kit, CC0 1.0,
  via `@netforge/asset-library-files`
- `tt_*`: the toytown-gl model kit (`@toytown/models` 0.2.0, https://github.com/bpowerie25/Toytown),
  CC0 1.0 (see its models/LICENSES.md)

`scripts/kit-embed.py` embeds them into `src/render3d/kitdata.ts`.
