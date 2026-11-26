# bigbrucestudios.com

A plain static site (no build step) for the studio's three store-required pages:

| Address | File | Used for |
|---|---|---|
| https://www.bigbrucestudios.com/ | `index.html` | Marketing URL on both stores |
| https://www.bigbrucestudios.com/privacy/ | `privacy/index.html` | Privacy policy URL (all three games, both stores) |
| https://www.bigbrucestudios.com/support/ | `support/index.html` | Support URL (App Store), website (Google Play), data deletion |

The games already link to `/privacy/` (Buildaroo and Skyrise Settings, PR #30) and Lumen Rush has
its own copy in `lumen-rush-privacy.html` (PR #28); this page includes the same Lumen Rush text.

## Putting it online (Cloudflare Pages, free, about 10 minutes)

1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Name the project `bigbrucestudios`, drag in **the contents of this folder** (not the folder itself), **Deploy**.
3. In the project → **Custom domains** → add `www.bigbrucestudios.com`, then `bigbrucestudios.com`.
   Porkbun: point the domain's nameservers to Cloudflare, or add the CNAME record Cloudflare shows.
4. Open https://www.bigbrucestudios.com/privacy/ on your phone to check.

Apple and Google both open the privacy URL during review, so it must be live before the first
submission.

When the privacy text changes, change `privacy/index.html` here, `launch/privacy.md` and
`lumen-rush-privacy.html` together, and update the date.
