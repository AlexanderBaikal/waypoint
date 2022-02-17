/** The Overpass API, as both import scripts talk to it. */

/**
 * Two mirrors, because both answer 504 often enough that one endpoint is not a
 * source.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Who is asking. Overpass asks scripts to identify themselves, and enforces it. */
const UA = "waypoint-fixture-import/1.0 (https://github.com/AlexanderBaikal)";

const nap = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs one Overpass QL query, trying each mirror in turn.
 *
 * Both mirrors failing usually means the API is busy rather than that the query
 * is wrong, so the round is repeated after a wait. An import spends minutes
 * getting back to this point, and losing it to one busy afternoon is worse than
 * waiting out three-quarters of a minute.
 */
export async function postOverpass(query, attempt = 0) {
  for (const endpoint of ENDPOINTS) {
    process.stderr.write(`  overpass: ${endpoint}\n`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
        },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) return await response.json();
      process.stderr.write(`    HTTP ${String(response.status)}\n`);
    } catch (error) {
      process.stderr.write(`    ${error.message}\n`);
    }
  }

  if (attempt >= 2) throw new Error("every Overpass endpoint failed");
  await nap(15_000 * (attempt + 1));
  return postOverpass(query, attempt + 1);
}
