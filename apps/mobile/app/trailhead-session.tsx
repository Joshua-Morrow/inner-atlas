/**
 * Trailhead Session — DEPRECATED
 * The Trailhead v2 session lives at /trailhead/session.
 * This stub redirects any legacy deep-links.
 */
import { Redirect } from 'expo-router';
export default function LegacyTrailheadSession() {
  return <Redirect href="/trailhead" />;
}
