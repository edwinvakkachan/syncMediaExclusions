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
import { shouldRunYts,updateYtsRunTime } from "./yts/yts.js";


async function main() {
  try {
    await log();

    console.log("syncMediaExclusions process started");
    await publishMessage({
      message: "syncMediaExclusions process started"
    });

    await initDB();
    console.log("db is ready");

const shouldRun =await shouldRunYts()

  const isRadarrAvailableagain = await checkRadarr();
  const isSonarrAvailableagain = await checkSonarr();


  if(isRadarrAvailableagain && isSonarrAvailableagain) {
     if (shouldRun) {
      console.log('Running mediaexclustion table creation sync...');
 await syncMediaExclusions();
 await updateYtsRunTime();
  await delay(1000,true);
  }
    
  }
  
    await publishMessage({
      message: "syncMediaExclusions completed successfully"
    });



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
