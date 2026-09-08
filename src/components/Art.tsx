import type { CSSProperties } from "react";
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    sprout: (
      <>
        <path d="M12 21v-9M12 16C3 17 2 8 3 5c8-1 11 4 9 11ZM12 11C11 3 18 2 22 3c0 7-4 11-10 8Z" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v17h17M8 15l4-5 4 2 5-7" />
      </>
    ),
    book: (
      <>
        <path d="M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2v15Z" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="8" cy="18" r="2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    check: <path d="m5 12 4 4L20 5" />,
    leaf: (
      <>
        <path d="M4 20C-1 5 13 2 21 3c1 13-5 19-17 17ZM4 20 16 8" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    sound: (
      <>
        <path d="m3 9 5 0 5-5v16l-5-5H3ZM17 8q5 4 0 8M20 4q8 8 0 16" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.leaf}
    </svg>
  );
}
export function Mole({
  digit,
  decorative = false,
}: {
  digit: number | string;
  decorative?: boolean;
}) {
  return (
    <svg
      className="mole-svg"
      viewBox="0 0 160 170"
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : `Number ${digit}`}
    >
      <ellipse cx="80" cy="155" rx="68" ry="12" fill="#493d3030" />
      <path d="M33 142q-4-49 47-54 51 5 47 54" fill="#d89068" />
      <path d="M42 106q38-24 76 0l8 49H34Z" fill="#efe9d6" />
      <path d="M42 106 30 129l16 8M118 106l12 23-16 8" fill="#efe9d6" />
      <ellipse cx="34" cy="124" rx="12" ry="9" fill="#b98261" />
      <ellipse cx="126" cy="124" rx="12" ry="9" fill="#b98261" />
      <circle cx="43" cy="48" r="17" fill="#967354" />
      <circle cx="117" cy="48" r="17" fill="#967354" />
      <circle cx="43" cy="48" r="10" fill="#d3aa8b" />
      <circle cx="117" cy="48" r="10" fill="#d3aa8b" />
      <path
        d="M31 74c0-65 98-65 98 0 0 28-20 42-49 42S31 102 31 74"
        fill="#ac8765"
      />
      <path d="M38 85q42-40 84 0c-6 34-78 35-84 0" fill="#dbc0a0" />
      <ellipse cx="58" cy="67" rx="4" ry="5.5" fill="#303d31" />
      <ellipse cx="102" cy="67" rx="4" ry="5.5" fill="#303d31" />
      <circle cx="59" cy="65" r="1.2" fill="white" />
      <circle cx="103" cy="65" r="1.2" fill="white" />
      <path d="M69 79q11-7 22 0-1 13-11 13T69 79" fill="#5a4439" />
      <path
        d="M72 98q8 6 16 0"
        fill="none"
        stroke="#785b45"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse cx="48" cy="86" rx="8" ry="4" fill="#ca977e" />
      <ellipse cx="112" cy="86" rx="8" ry="4" fill="#ca977e" />
      <text
        x="80"
        y="145"
        textAnchor="middle"
        fontFamily="Arial,sans-serif"
        fontSize="39"
        fontWeight="700"
        fill="#244d3c"
      >
        {digit}
      </text>
    </svg>
  );
}
export function Garden() {
  return (
    <div className="garden-art" aria-hidden="true">
      <svg viewBox="0 0 600 440" className="garden-landscape">
        <defs>
          <linearGradient id="sky" x2="0" y2="1">
            <stop stopColor="#e9edda" />
            <stop offset="1" stopColor="#f3efde" />
          </linearGradient>
        </defs>
        <circle cx="325" cy="215" r="195" fill="url(#sky)" />
        <circle cx="450" cy="84" r="32" fill="#e9c57f" opacity=".8" />
        <path d="M104 262q86-90 174-35 126-119 245 13v81H104Z" fill="#d1ddba" />
        <path d="M65 309q97-105 258-36 85-46 206 11l-3 68H67Z" fill="#b8caa1" />
        <ellipse cx="300" cy="338" rx="256" ry="77" fill="#a5bb8c" />
        <path
          d="M95 321q209-67 408 10M86 354q221-63 423 4M169 291l-40 82M260 282l-8 115M357 284l34 105M441 298l47 74"
          stroke="#d7dfb8"
          strokeWidth="3"
          fill="none"
          opacity=".6"
        />
        {[
          [155, 305],
          [290, 290],
          [425, 310],
          [190, 366],
          [341, 359],
          [469, 363],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="43" ry="15" fill="#7f9670" />
            <ellipse cx={x} cy={y - 3} rx="35" ry="10" fill="#655a43" />
          </g>
        ))}
        <g fill="#668764">
          <path d="M110 294q-34-64-11-85 36 38 11 85" />
          <path d="M107 294q-66-19-58-49 51-4 58 49" />
          <path d="M507 309q-18-86 13-98 25 50-13 98" />
          <path d="M510 308q12-63 51-59 7 36-51 59" />
        </g>
        <g stroke="#526f50" strokeWidth="3" fill="none">
          <path d="m106 300-10-52m414 64 17-57M80 348l-8-22m8 22 9-15M385 280l-3-20m3 20 12-14M245 380l-6-19m6 19 8-15" />
        </g>
        <g fill="#f1dfb2">
          <circle cx="72" cy="324" r="7" />
          <circle cx="382" cy="258" r="6" />
          <circle cx="238" cy="359" r="6" />
        </g>
        <path
          d="M180 144q16-14 30 0m-11-23q15-14 29 0"
          stroke="#7f9670"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="hero-mole">
        <Mole digit="3" decorative />
      </div>
      <div className="floating-label label-match">
        <span>✓</span> A little focus.
      </div>
      <div className="floating-label label-grow">
        <Icon name="sprout" size={18} /> Room to grow.
      </div>
    </div>
  );
}
export function Sprig({ style }: { style?: CSSProperties }) {
  return (
    <span className="sprig" style={style}>
      <Icon name="sprout" size={32} />
    </span>
  );
}
