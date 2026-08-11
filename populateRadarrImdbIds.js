
import pool from "./db/pool.js";

async function getImdbIdFromTmdb(tmdbId) {
    const response = await fetch(
        `${process.env.RADARR_URL}/api/v3/movie/lookup/tmdb?tmdbId=${tmdbId}`,
        {
            headers: {
                "X-Api-Key": process.env.RADARR_API_KEY
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Radarr lookup failed: ${response.status}`);
    }

    const movie = await response.json();

    return movie.imdbId || null;
}

export async function populateRadarrImdbIds() {
    console.log("Starting Radarr IMDb ID population...");

    const { rows } = await pool.query(`
        SELECT id, title, tmdb_id
        FROM media_exclusions
        WHERE source = 'radarr'
          AND imdb_id IS NULL
          AND tmdb_id IS NOT NULL
        ORDER BY id
    `);

    console.log(`Found ${rows.length} Radarr movies to process.`);

    let updated = 0;
    let notFound = 0;
    let failed = 0;

    for (const row of rows) {
        try {
            console.log(
                `Processing: ${row.title} (TMDb: ${row.tmdb_id})`
            );

            const imdbId = await getImdbIdFromTmdb(row.tmdb_id);

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

            // Small delay between Radarr requests
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(
                `Failed: ${row.title} (TMDb: ${row.tmdb_id})`,
                error.message
            );

            failed++;
        }
    }

    console.log("\nIMDb population finished.");
    console.log(`Updated:   ${updated}`);
    console.log(`Not found: ${notFound}`);
    console.log(`Failed:    ${failed}`);
}