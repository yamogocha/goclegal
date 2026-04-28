// // 2-phase execution script (no timeout)

async function run() {
  const URL = process.env.BASE_URL + "/api/cron/googleAds/setup";

  try {
    console.log("=== STEP 1: GENERATE ===");

    const genRes = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        mode: "generate",
        location: "Oakland CA",
      }),
    });

    const genData = await genRes.json();

    if (!genData.ok) {
      console.error("GEN FAILED", genData);
      process.exit(1);
    }

    console.log("=== STEP 2: EXECUTE ===");

    const execRes = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        mode: "execute",
        data: genData.data, // // pass payload
        phoneNumber: "+15108460928",
      }),
    });

    const text = await execRes.text();

    let execData;
    try {
      execData = JSON.parse(text);
    } catch {
      console.error("NON JSON:", text.slice(0, 1000));
      process.exit(1);
    }

    console.dir(execData, { depth: null });

    if (!execData.ok) {
      console.error("EXEC FAILED", execData);
      process.exit(1);
    }

    console.log("=== COMPLETE ===");

  } catch (e: any) {
    console.error("CRASH", e.message);
    process.exit(1);
  }
}

run();