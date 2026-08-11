import "dotenv/config";
import { delay } from "./delay.js";
import {
  triggerHomeAssistantWebhook,
  triggerHomeAssistantWebhookWhenErrorOccurs
} from "./homeassistant/homeAssistantWebhook.js";
import { log } from "./timelog.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { publishMessage } from "./queue/publishMessage.js";
import { initDB } from "./db/db.js";
import { checkRadarr, checkSonarr } from "./radarrSonarravailabilitycheck.js";
import { syncMediaExclusions } from "./addingtorrents/syncMediaExclusions.js";
import {populateRadarrImdbIds } from "./populateRadarrImdbIds.js";
import { populateSonarrImdbIds } from "./populateSonarrImdbIds.js";

async function main() {
  try {
    await log();

    console.log("syncMediaExclusions process started");


    await initDB();
    console.log("db is ready");


  const isRadarrAvailableagain = await checkRadarr();
  const isSonarrAvailableagain = await checkSonarr();


  if(isRadarrAvailableagain && isSonarrAvailableagain) {

     await syncMediaExclusions();

  }
  else {
    console.log('Radarr and sonarr are in offline');
     process.exit(1);
  }

  if (await checkRadarr()){
    await populateRadarrImdbIds();
  }
  else {
    console.log('Radarr unavialble');
    process.exit(1);
  }
  
  if (await checkSonarr()){
    await populateSonarrImdbIds();
  }
  else {
    console.log('sonarr unavialble');
    process.exit(1);
  }


    await log();
  } catch (error) {
    console.error("Fatal error in main():");
    console.error(error);

    await publishMessage({
      message: "Fatal error in main()"
    });

    await retry(
      triggerHomeAssistantWebhookWhenErrorOccurs,
      { status: "error" },
      "homeassistant-error",
      5
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
