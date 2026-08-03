import { pathToFileURL } from "node:url";

export { processFixtureFile, processRawMessages } from "./process-fixtures.js";
export { processScoringFixtureFile, scoreConsolidatedOffers } from "./process-scoring-fixtures.js";
export { WorkerPipeline, InMemoryWorkerRepository } from "./pipeline.js";
export { FakeNotificationProvider, FcmNotificationProvider } from "./notification.js";
export { DEFAULT_JOB_OPTIONS, PIPELINE_QUEUES } from "./queue-config.js";
export type { ProcessFixturesOptions, RawFixtureMessage } from "./process-fixtures.js";
export type { ProcessScoringFixturesOptions } from "./process-scoring-fixtures.js";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import("./process-fixtures.js").then(async ({ processFixtureFile }) => {
    const result = await processFixtureFile();
    console.log(
      JSON.stringify({ offers: result.offers.length, offerMentions: result.offerMentions.length })
    );
  });
}
