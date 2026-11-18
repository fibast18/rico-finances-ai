# Rico Finances AI — Git-based CI/CD

Repository: https://github.com/fibast18/rico-finances-ai
Website: https://fibast18.github.io/rico-finances-ai/
Default branch: `main`

## How automatic deployment works

The workflow in `.github/workflows/deploy-pages.yml` runs whenever code is committed to `main`.
It checks the app's JavaScript syntax, inline scripts, required asset files, manifest,
service-worker precache list, and app version consistency. If validation passes,
it builds and publishes the static website through GitHub Pages. A failed check
blocks deployment rather than replacing the working website. Pull requests are
validated but are **not** deployed; changes to `main` and manual workflow runs deploy.

Review deployments: https://github.com/fibast18/rico-finances-ai/actions

## Editing the app in GitHub (no ZIP upload needed)

1. Open the repository's **Code** tab.
2. Open a source file (for example, `index.html`) and choose the pencil/Edit icon.
3. Make the change, then choose **Commit changes** to `main`.
4. Open **Actions** and verify that both **Validate offline app** and
   **Deploy to GitHub Pages** are green.
5. Open your usual website address. No manual GitHub Pages upload is needed.

If you prefer a Mac terminal, use the normal Git workflow:

```sh
git clone https://github.com/fibast18/rico-finances-ai.git
cd rico-finances-ai
# Edit files with your editor.
git add .
git commit -m "Describe the app update"
git push origin main
```

For later updates in an already cloned copy, run `git pull` before editing.

## Important when releasing a new offline PWA version

Because this app uses a cache-first offline service worker, release changes should
increment the version consistently in:

- `version.json` — `version` field
- `index.html` — `RICO_APP_VERSION` constant and any displayed footer version
- `sw.js` — `CACHE_NAME` version and the APP_SHELL asset list if files change

The validation script checks the version and offline file list so mistakes block
deployment. A Git commit automatically deploys the website; Home Screen PWA
installations still use normal service-worker update behavior and may require
reopening the app while online. Do not uninstall to force a refresh.

## Important safeguards

- GitHub Pages and this repository are **public**. Do not commit an OpenAI API key,
  Ask Rico access code, session token, passwords, or personal transaction backups.
- `ai-config.js` contains only the public URL of the shared Cloudflare Worker.
  The Worker and its protected API key are **not** part of this deployment.
- Existing finance transactions stay in each device's local storage, not the repo.
  Commits and Pages deployments do not intentionally touch them. Export backups
  before changes that may affect storage or the installed PWA.
- This automation applies **only to rico-finances-ai**, not the coworkers' app.
- The `ci/validate-and-build.mjs` tool can also be run locally with Node.js 22:
  `node ci/validate-and-build.mjs`. Output in `dist/` is created for deployment.

If a deploy fails, review the failed step in the Actions run. Check GitHub repository
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
Do not delete and reupload the complete repository to fix a CI issue.
