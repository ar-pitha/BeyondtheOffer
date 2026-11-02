import axios from "axios";

let request = null;

// One visit per page load; the cached promise is shared by the app shell and
// the landing page so they never double count.
export function trackSiteView() {
  if (!request) {
    request = axios
      .post("/api/views")
      .then(({ data }) => data.views)
      .catch(() => null);
  }
  return request;
}
