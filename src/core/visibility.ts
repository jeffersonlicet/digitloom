/** @fileoverview Shares document visibility and reduced-motion observers across counters. */
interface MotionClient {
  visible: boolean;
  notify: (allowed: boolean) => void;
}

interface MotionEnvironment {
  clients: Map<Element, MotionClient>;
  observer: IntersectionObserver;
  media: MediaQueryList;
  changed: () => void;
}

const environments = new WeakMap<Document, MotionEnvironment>();

/** Shares visibility and motion observers across all counters in one document. */
export function observeNumberMotion(
  element: Element,
  notify: (allowed: boolean) => void,
): () => void {
  const document = element.ownerDocument;
  const window = document.defaultView;
  if (!window)
    throw new Error("Digitloom requires an element in a browser document.");
  let environment = environments.get(document);

  if (!environment) {
    const clients = new Map<Element, MotionClient>();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const allowed = (client: MotionClient) =>
      client.visible &&
      !media.matches &&
      document.visibilityState === "visible";
    const changed = () => {
      clients.forEach((client) => client.notify(allowed(client)));
    };
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const client = clients.get(entry.target);
        if (!client) return;
        client.visible = entry.isIntersecting;
        client.notify(allowed(client));
      });
    });
    environment = { clients, observer, media, changed };
    media.addEventListener("change", changed);
    document.addEventListener("visibilitychange", changed);
    environments.set(document, environment);
  }

  environment.clients.set(element, { visible: false, notify });
  environment.observer.observe(element);
  const current = environment;
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    current.observer.unobserve(element);
    current.clients.delete(element);
    if (current.clients.size > 0) return;
    current.observer.disconnect();
    current.media.removeEventListener("change", current.changed);
    document.removeEventListener("visibilitychange", current.changed);
    environments.delete(document);
  };
}
