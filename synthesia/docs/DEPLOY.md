# Deploying the prototype (static site)

`npm run build` writes a static site to `dist/`. Asset paths are relative (`base: './'` in `vite.config.ts`), so it
works from any host or sub-path. There's no backend and no environment variables.

Pick one. **Publishing makes the link public**, so check with the owner first.

## Netlify (drag and drop, no account setup in the repo)
1. `npm run build`
2. Go to https://app.netlify.com/drop and drop the `dist/` folder.
3. Netlify gives you a `*.netlify.app` link. Rename the site in Site settings if you want.

Or use the CLI: `npx netlify-cli deploy --dir=dist --prod` (it asks you to log in).

## Vercel
1. `npx vercel` from the repo root (log in when asked). Framework preset: **Vite**, output directory: **dist**.
2. `npx vercel --prod` for the final link.

## GitHub Pages
1. Push the repo to GitHub.
2. Build and publish `dist/` to the `gh-pages` branch: `npm run build && npx gh-pages -d dist`.
3. In repo Settings → Pages, choose the `gh-pages` branch.
   The site is served at `https://<user>.github.io/<repo>/`. Relative paths make the sub-path work.

## Before sharing
- Open the link in Chrome and click **▶ Guided demo**. Browsers only allow speech after a click on the page.
- The microphone needs HTTPS, which all three hosts provide.
