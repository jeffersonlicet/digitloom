/** @fileoverview Checks release identity before CI builds a public package. */
import { appendFileSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const { RELEASE_TAG, RELEASE_PRERELEASE, GITHUB_REPOSITORY, GITHUB_OUTPUT } =
  process.env;
const { name, version, repository } = manifest;

if (
  name !== "digitloom" ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)
) {
  throw new Error(
    "Use the Digitloom package name and a valid release version.",
  );
}
if (RELEASE_TAG !== `v${version}`) {
  throw new Error(
    "The release tag must equal v followed by package.json version.",
  );
}
const preview = version.includes("-");
if (RELEASE_PRERELEASE !== String(preview)) {
  throw new Error("The GitHub prerelease flag must match the package version.");
}
if (
  !GITHUB_REPOSITORY ||
  repository?.type !== "git" ||
  repository.url !== `git+https://github.com/${GITHUB_REPOSITORY}.git`
) {
  throw new Error(
    "Set repository.url to git+https://github.com/OWNER/REPOSITORY.git before release. See RELEASING.md.",
  );
}
if (manifest.private || manifest.publishConfig?.access !== "public") {
  throw new Error("The release package must allow public publication.");
}
if (!GITHUB_OUTPUT) {
  throw new Error("Run this script in the GitHub release workflow.");
}
appendFileSync(
  GITHUB_OUTPUT,
  `npm_tag=${preview ? "next" : "latest"}\npackage_file=${name}-${version}.tgz\n`,
);
