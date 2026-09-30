/** @fileoverview Explains installation, value updates, and customization. */
import React from "react";

import usage from "./examples/usage.tsx.txt?highlight";
import styling from "./examples/styling.css.txt?highlight";
import group from "./examples/group.tsx.txt?highlight";
import motion from "./examples/motion.tsx.txt?highlight";
import { CodeExample } from "./CodeExample";

const props = [
  [
    "value",
    "string",
    "Required",
    "Exact formatted text. No rounding or currency conversion.",
  ],
  [
    "className",
    "string",
    '""',
    "Apply your typography, color, and size with CSS.",
  ],
  [
    "duration",
    "number",
    "350",
    "Milliseconds. Use a finite, nonnegative number. Zero disables motion.",
  ],
  [
    "easing",
    "string",
    "cubic-bezier(0.16, 1, 0.3, 1)",
    "Any valid CSS easing. Invalid timing throws before an update.",
  ],
  [
    "animated",
    "boolean",
    "true",
    "Enable rolling updates. Reduced-motion preferences still apply.",
  ],
];

/** Shows the public API without adding work to each live counter update. */
export const UsageGuide = React.memo(function UsageGuide() {
  return (
    <section
      className="usage-guide"
      id="getting-started"
      aria-labelledby="guide-heading"
    >
      <div className="integration">
        <div>
          <h2 id="guide-heading">How to</h2>
          <p>
            Use React 18 or 19. Import the stylesheet once in your application.
          </p>
        </div>
        <div className="guide-install">
          <pre aria-label="Installation command">
            <code>npm install digitloom</code>
          </pre>
        </div>
      </div>
      <div className="integration">
        <div>
          <p className="eyebrow">01 / Use it</p>
          <h3>Install. Import. Animate.</h3>
          <p>
            Pass your formatted text. Update the value to animate the changed
            digits.
          </p>
        </div>
        <CodeExample label="React usage example" html={usage} />
      </div>
      <details className="guide-disclosure">
        <summary>Personalize</summary>
        <div className="integration">
          <div>
            <h2>
              Typography, color,
              <br />
              and motion.
            </h2>
            <p>
              Use your own CSS class. The counter inherits font, color, size,
              and line height.
            </p>
            <p>
              Set an explicit line height. Leave room for the longest value.
              Tabular digits keep digit widths consistent.
            </p>
            <p>
              Use duration and easing to adjust motion. Set animated to false
              for immediate updates.
            </p>
          </div>
          <div className="guide-examples">
            <CodeExample label="CSS customization example" html={styling} />
            <CodeExample label="Motion customization example" html={motion} />
          </div>
        </div>
      </details>
      <details className="guide-disclosure">
        <summary>Use in a list or grid</summary>
        <div className="integration">
          <div>
            <h2>
              One canvas.
              <br />
              Many counters.
            </h2>
            <p>
              Wrap a list in RollingNumberGroup. Apply layout and scrolling to
              the group. Counters share rendering work.
            </p>
          </div>
          <CodeExample label="Dense list example" html={group} />
        </div>
      </details>
      <details className="guide-reference">
        <summary>API reference</summary>

        <div
          className="guide-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Component props"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Prop</th>
                <th scope="col">Type</th>
                <th scope="col">Default</th>
                <th scope="col">Use</th>
              </tr>
            </thead>
            <tbody>
              {props.map(([name, type, defaultValue, detail]) => (
                <tr key={name}>
                  <th scope="row">
                    <code>{name}</code>
                  </th>
                  <td>
                    <code>{type}</code>
                  </td>
                  <td>
                    <code>{defaultValue}</code>
                  </td>
                  <td>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="guide-notes">
          <p>
            Animate one numeric segment with ASCII digits, a dot decimal
            separator, and optional comma grouping. Prefixes, suffixes, and
            signs keep their exact text.
          </p>
          <p>
            Exact text stays selectable and available to assistive technology.
            Reduced motion, page visibility, and viewport visibility control
            animation automatically.
          </p>
          <p>
            Use modern browsers with Canvas 2D, Web Animations,
            IntersectionObserver, and ResizeObserver. React Native is not
            supported.
          </p>
        </div>
      </details>
    </section>
  );
});
