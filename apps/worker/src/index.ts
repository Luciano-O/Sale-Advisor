import { pathToFileURL } from "node:url";

export { processFixtureFile, processRawMessages } from "./process-fixtures.js";
export type { ProcessFixturesOptions, RawFixtureMessage } from "./process-fixtures.js";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import("./process-fixtures.js").then(async ({ processFixtureFile }) => {
    const result = await processFixtureFile();
    console.log(JSON.stringify({ offers: result.offers.length, offerMentions: result.offerMentions.length }));
  });
}
