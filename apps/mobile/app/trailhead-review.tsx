/**
 * Trailhead Review — DEPRECATED
 * The Trailhead v2 integration/review lives at /trailhead/integration.
 * This stub redirects any legacy deep-links.
 */
import { Redirect } from 'expo-router';
export default function LegacyTrailheadReview() {
  return <Redirect href="/trailhead" />;
}
