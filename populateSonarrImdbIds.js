import pool from "./db/pool.js";

async function getImdbIdFromTvdb(tvdbId) {
    const response = await fetch(
        `${process.env.SONARR_URL}/api/v3/series/lookup?term=tvdb:${tvdbId}`,
        {
            headers: {
                "X-Api-Key": process.env.SONARR_API_KEY
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `Sonarr lookup failed: ${response.status}`
        );
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    // Find the exact TVDB match
    const series = results.find(
        item => Number(item.tvdbId) === Number(tvdbId)
    );

    return series?.imdbId || null;
}


export async function populateSonarrImdbIds() {
    console.log("Starting Sonarr IMDb ID population...");

    const { rows } = await pool.query(`
        SELECT id, title, tvdb_id
        FROM media_exclusions
        WHERE source = 'sonarr'
          AND imdb_id IS NULL
          AND tvdb_id IS NOT NULL
        ORDER BY id
    `);

    console.log(
        `Found ${rows.length} Sonarr series to process.`
    );

    let updated = 0;
    let notFound = 0;
    let failed = 0;

    for (const row of rows) {
        try {
            console.log(
                `Processing: ${row.title} (TVDb: ${row.tvdb_id})`
            );

            const imdbId = await getImdbIdFromTvdb(row.tvdb_id);

            if (!imdbId) {
                console.log(
                    `No IMDb ID found: ${row.title}`
                );

                notFound++;
                continue;
            }

            await pool.query(
                `
                UPDATE media_exclusions
                SET imdb_id = $1,
                    last_seen = NOW()
                WHERE id = $2
                `,
                [imdbId, row.id]
            );

            console.log(
                `Updated: ${row.title} → ${imdbId}`
            );

            updated++;

            // Avoid sending requests too quickly
            await new Promise(resolve =>
                setTimeout(resolve, 100)
            );

        } catch (error) {
            console.error(
                `Failed: ${row.title} (TVDb: ${row.tvdb_id})`,
                error.message
            );

            failed++;
        }
    }

    console.log("\nSonarr IMDb population finished.");
    console.log(`Updated:   ${updated}`);
    console.log(`Not found: ${notFound}`);
    console.log(`Failed:    ${failed}`);
}