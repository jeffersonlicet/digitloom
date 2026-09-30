# Release Digitloom

Publishing a GitHub Release starts `.github/workflows/release.yml`.
The workflow validates the tag, runs release checks, and packages the checked source.
The publish job downloads that archive. It does not rebuild the package.

## Configure publication

1. Create `jeffersonlicet/digitloom` on GitHub.
2. Create the GitHub environment `npm-release`.
3. Add an npm granular publishing token as the environment secret `NPM_TOKEN`.
4. Grant package publishing permission. Use the narrowest scope that permits the first publication.
5. Set a short expiration date and record its renewal date outside the repository.
6. Keep the token in GitHub Secrets. Do not store it in source files or logs.
7. Enable GitHub Pages with GitHub Actions as the publishing source.

The first publication creates the npm package. Afterward, restrict the token to Digitloom or configure npm trusted publishing.
The token is supplied as `NODE_AUTH_TOKEN` only in the publish step.
GitHub Actions publishes the package. Local commands only build and inspect it.

## Release v1.0.0

1. Run `npm ci` with Node.js 24.
2. Run `npm run check`.
3. Review browser motion, selection, zoom, scrolling, and reduced motion.
4. Run the three-library benchmark against the release code.
5. Save the latest measurements in `demo/scaling-baseline.json`.
6. Confirm the npm package name is available.
7. Run `npm pack --dry-run --ignore-scripts`.
8. Review the archive contents.
9. Commit and push the checked source.
10. Create the tag `v1.0.0`.
11. Publish a stable GitHub Release for that tag.
12. Review the release workflow and confirm the npm version.
13. Run the Pages workflow and confirm the deployed site.

The tag must match the manifest version. Stable versions publish to npm `latest`. Preview versions publish to `next`.
A failed check stops publication. A GitHub tag or release alone does not prove npm publication.
If npm already contains the version, verify its contents before continuing. Use a new version for changed contents.
