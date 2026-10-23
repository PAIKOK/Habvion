import type { FurnitureItem } from "@shared/types/home";

const S = "#4d4a42";
/**
 * Top-down plan symbol in the item's own frame: centred on 0,0, width along x, depth
 * along y, the front facing +y (south) as at rotation 0.
 */
export function FurnitureShape({ item }: { item: FurnitureItem }) {
  const w = item.width,
    d = item.depth,
    x0 = -w / 2,
    y0 = -d / 2,
    c = item.colorHex,
    sw = 0.05,
    base = { stroke: S, strokeWidth: sw },
    body = (r = 0.08, fill = `${c}55`) => (
      <rect x={x0} y={y0} width={w} height={d} rx={r} fill={fill} {...base} />
    ),
    overhead = { fill: "none", stroke: S, strokeWidth: sw, strokeDasharray: ".2 .12" };
  switch (item.shape) {
    case "sofa":
    case "armchair": {
      const arm = Math.min(0.5, w * 0.12),
        back = Math.min(0.7, d * 0.25),
        seats = item.shape === "armchair" ? 1 : Math.max(1, Math.round((w - 2 * arm) / 2.2));
      return (
        <g>
          {body(0.2)}
          <rect x={x0} y={y0} width={w} height={back} rx={0.15} fill={`${c}aa`} {...base} />
          <rect x={x0} y={y0} width={arm} height={d} rx={0.15} fill={`${c}aa`} {...base} />
          <rect x={-x0 - arm} y={y0} width={arm} height={d} rx={0.15} fill={`${c}aa`} {...base} />
          {Array.from({ length: seats - 1 }, (_, i) => {
            const x = x0 + arm + ((w - 2 * arm) / seats) * (i + 1);
            return <path key={i} d={`M${x} ${y0 + back}V${-y0 - 0.1}`} {...base} />;
          })}
        </g>
      );
    }
    case "chair":
      return (
        <g>
          <rect
            x={x0 + 0.08}
            y={y0 + 0.2}
            width={w - 0.16}
            height={d - 0.25}
            rx={0.12}
            fill={`${c}66`}
            {...base}
          />
          <rect x={x0} y={y0} width={w} height={0.28} rx={0.1} fill={`${c}cc`} {...base} />
        </g>
      );
    case "diwan":
      return (
        <g>
          {body(0.15)}
          <ellipse cx={x0 + 0.4} cy={0} rx={0.28} ry={d * 0.35} fill={`${c}aa`} {...base} />
          <ellipse cx={-x0 - 0.4} cy={0} rx={0.28} ry={d * 0.35} fill={`${c}aa`} {...base} />
        </g>
      );
    case "swing":
      return (
        <g>
          <rect
            x={x0}
            y={y0}
            width={w}
            height={d}
            fill="none"
            {...base}
            strokeDasharray=".25 .12"
          />
          <rect
            x={x0 + 0.4}
            y={-0.6}
            width={w - 0.8}
            height={1.2}
            rx={0.1}
            fill={`${c}88`}
            {...base}
          />
          {[x0 + 0.5, -x0 - 0.5].map((x) => (
            <path key={x} d={`M${x} ${y0}V${-0.6}`} {...base} />
          ))}
        </g>
      );
    case "table":
      return Math.abs(w - d) < 0.01 && /round/.test(item.id) ? (
        <circle r={w / 2} fill={`${c}55`} {...base} />
      ) : (
        <g>
          {body(0.12)}
          <rect
            x={x0 + 0.15}
            y={y0 + 0.15}
            width={w - 0.3}
            height={d - 0.3}
            rx={0.08}
            fill="none"
            {...base}
            strokeOpacity=".4"
          />
        </g>
      );
    case "desk":
      return (
        <g>
          {body(0.06)}
          <path d={`M${-x0 - Math.min(1.3, w * 0.35)} ${y0}V${-y0}`} {...base} />
        </g>
      );
    case "bed": {
      const head = Math.min(0.45, d * 0.08),
        pillows = w > 4 ? 2 : 1,
        pw = (w - 0.6) / pillows - 0.15 * (pillows - 1);
      return (
        <g>
          {body(0.1, "#fbfaf7")}
          <rect x={x0} y={y0} width={w} height={head} fill={`${c}cc`} {...base} />
          {Array.from({ length: pillows }, (_, i) => (
            <rect
              key={i}
              x={x0 + 0.3 + i * (pw + 0.15)}
              y={y0 + head + 0.15}
              width={pw}
              height={0.9}
              rx={0.2}
              fill="#f2efe9"
              {...base}
            />
          ))}
          <rect
            x={x0 + 0.05}
            y={y0 + d * 0.38}
            width={w - 0.1}
            height={d * 0.6}
            rx={0.1}
            fill={`${c}44`}
            {...base}
          />
          <path d={`M${x0 + 0.05} ${y0 + d * 0.48}H${-x0 - 0.05}`} {...base} strokeOpacity=".5" />
        </g>
      );
    }
    case "wardrobe":
    case "cabinet": {
      const doors = Math.max(1, Math.round(w / (item.shape === "wardrobe" ? 2 : 1.5)));
      return (
        <g>
          {body(0.04)}
          {Array.from({ length: doors - 1 }, (_, i) => (
            <path key={i} d={`M${x0 + (w / doors) * (i + 1)} ${y0}V${-y0}`} {...base} />
          ))}
          <path d={`M${x0} ${-y0 - 0.12}H${-x0}`} {...base} strokeOpacity=".5" />
          {item.shape === "wardrobe" && (
            <path
              d={`M${x0} ${y0}L${-x0} ${-y0}M${-x0} ${y0}L${x0} ${-y0}`}
              {...base}
              strokeOpacity=".25"
            />
          )}
        </g>
      );
    }
    case "shelf":
      return (
        <g>
          {body(0.03)}
          {Array.from({ length: Math.max(1, Math.round(w / 1.2)) - 1 }, (_, i) => (
            <path
              key={i}
              d={`M${x0 + (w / Math.max(1, Math.round(w / 1.2))) * (i + 1)} ${y0}V${-y0}`}
              {...base}
              strokeOpacity=".6"
            />
          ))}
        </g>
      );
    case "counter":
      return (
        <g>
          {body(0.02, "#efebe4")}
          <path d={`M${x0} ${-y0 - 0.15}H${-x0}`} {...base} />
        </g>
      );
    case "sink":
      return (
        <g>
          {body(0.08, "#dfe3e6")}
          {[-w / 4, w / 4].map((x) => (
            <rect
              key={x}
              x={x - w / 5}
              y={y0 + 0.25}
              width={(w * 2) / 5}
              height={d - 0.5}
              rx={0.2}
              fill="#f7f9fa"
              {...base}
            />
          ))}
        </g>
      );
    case "hob":
      return (
        <g>
          {body(0.06, "#3a3a3a")}
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([a, b]) => (
            <circle
              key={`${a}${b}`}
              cx={(a! * w) / 4}
              cy={(b! * d) / 4}
              r={Math.min(w, d) / 6}
              fill="none"
              stroke="#d0d0d0"
              strokeWidth={sw}
            />
          ))}
        </g>
      );
    case "chimney":
    case "pendant":
    case "fan":
      return item.shape === "fan" ? (
        <g {...overhead}>
          <circle r={0.25} />
          {[0, 120, 240].map((a) => (
            <ellipse key={a} cx={0} cy={-w / 4} rx={0.18} ry={w / 4.4} transform={`rotate(${a})`} />
          ))}
        </g>
      ) : item.shape === "pendant" ? (
        <g {...overhead}>
          <circle r={w / 2} />
          <circle r={w / 6} />
        </g>
      ) : (
        <rect x={x0} y={y0} width={w} height={d} {...overhead} />
      );
    case "wc":
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d * 0.3} rx={0.06} fill="#fbfbfa" {...base} />
          <ellipse cx={0} cy={y0 + d * 0.62} rx={w * 0.42} ry={d * 0.36} fill="#fbfbfa" {...base} />
        </g>
      );
    case "basin":
      return (
        <g>
          {body(0.1, w > 2.5 ? `${c}88` : "#fbfbfa")}
          {(w > 4 ? [-w / 4, w / 4] : [0]).map((x) => (
            <ellipse
              key={x}
              cx={x}
              cy={0.1}
              rx={Math.min(0.75, w / 3)}
              ry={d * 0.3}
              fill="#f7f9fa"
              {...base}
            />
          ))}
        </g>
      );
    case "shower":
      return (
        <g>
          {body(0.02, "#e7f1f3")}
          <path
            d={`M${x0} ${y0}L${-x0} ${-y0}M${-x0} ${y0}L${x0} ${-y0}`}
            {...base}
            strokeOpacity=".35"
          />
          <circle r={0.15} fill="none" {...base} />
        </g>
      );
    case "bath":
      return (
        <g>
          {body(0.4, "#fbfbfa")}
          <rect
            x={x0 + 0.25}
            y={y0 + 0.25}
            width={w - 0.5}
            height={d - 0.5}
            rx={0.6}
            fill="#eef5f7"
            {...base}
          />
        </g>
      );
    case "fridge":
      return (
        <g>
          {body(0.08)}
          <path d={`M${x0} ${-y0 - 0.2}H${-x0}`} {...base} />
          {w > 2.6 && <path d={`M0 ${y0}V${-y0}`} {...base} />}
        </g>
      );
    case "washer":
      return (
        <g>
          {body(0.08, "#f4f4f2")}
          <circle r={Math.min(w, d) * 0.32} fill="#dfe6ea" {...base} />
        </g>
      );
    case "ac":
    case "appliance":
      return (
        <g>
          {body(0.05)}
          {d > 0.6 && (
            <rect
              x={x0 + 0.12}
              y={y0 + 0.12}
              width={w - 0.24}
              height={d - 0.24}
              rx={0.04}
              fill="none"
              {...base}
              strokeOpacity=".5"
            />
          )}
        </g>
      );
    case "lamp":
      return (
        <g>
          <circle r={w / 2} fill="#f6ecd2" {...base} />
          <path d={`M${-w / 3} 0H${w / 3}M0 ${-w / 3}V${w / 3}`} {...base} />
        </g>
      );
    case "sconce":
      return (
        <path d={`M${x0} ${y0}A${w / 2} ${w / 2} 0 0 0 ${-x0} ${y0}Z`} fill="#f6ecd2" {...base} />
      );
    case "plant":
      return (
        <g>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse
              key={a}
              cx={0}
              cy={-w / 4}
              rx={w / 7}
              ry={w / 4}
              transform={`rotate(${a})`}
              fill={`${c}aa`}
              {...base}
              strokeOpacity=".5"
            />
          ))}
          <circle r={w / 7} fill="#8d6e55" {...base} />
        </g>
      );
    case "tree":
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={Math.cos(a) * w * 0.3}
                cy={Math.sin(a) * w * 0.3}
                r={w * 0.2}
                fill={`${c}66`}
                {...base}
                strokeOpacity=".35"
              />
            );
          })}
          <circle r={w * 0.12} fill="#6b4b33" />
        </g>
      );
    case "car":
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} rx={w * 0.25} fill={`${c}88`} {...base} />
          <rect
            x={x0 + w * 0.12}
            y={y0 + d * 0.28}
            width={w * 0.76}
            height={d * 0.42}
            rx={w * 0.12}
            fill="#dfe8ee"
            {...base}
          />
        </g>
      );
    case "bike":
      return (
        <g>
          <ellipse rx={w * 0.25} ry={d / 2} fill={`${c}88`} {...base} />
          <path d={`M${x0} ${y0 + d * 0.3}H${-x0}`} {...base} />
        </g>
      );
    case "rug":
      return (
        <g>
          {Math.abs(w - d) < 0.01 ? (
            <circle r={w / 2} fill={`${c}40`} {...base} strokeOpacity=".4" />
          ) : (
            <rect x={x0} y={y0} width={w} height={d} fill={`${c}40`} {...base} strokeOpacity=".4" />
          )}
          {Math.abs(w - d) >= 0.01 && (
            <rect
              x={x0 + 0.3}
              y={y0 + 0.3}
              width={w - 0.6}
              height={d - 0.6}
              fill="none"
              stroke={c}
              strokeWidth={sw}
              strokeOpacity=".6"
            />
          )}
        </g>
      );
    case "mirror":
    case "art":
      return (
        <rect
          x={x0}
          y={y0}
          width={w}
          height={Math.max(d, 0.15)}
          fill={item.shape === "mirror" ? "#d7e4e8" : `${c}cc`}
          {...base}
        />
      );
    case "curtain":
      return (
        <path
          d={
            `M${x0} 0` +
            Array.from(
              { length: Math.ceil(w / 0.5) },
              (_, i) => `q.125 ${i % 2 ? 0.2 : -0.2} .25 0t.25 0`,
            ).join("")
          }
          fill="none"
          stroke={c}
          strokeWidth=".08"
        />
      );
    case "mandir":
      return (
        <g>
          {body(0.04)}
          <path
            d={`M${x0 + 0.2} ${-y0 - 0.2}L0 ${y0 + 0.2}L${-x0 - 0.2} ${-y0 - 0.2}`}
            fill="none"
            {...base}
          />
        </g>
      );
    case "tank":
      return (
        <g>
          <circle r={w / 2} fill={`${c}aa`} {...base} />
          <circle r={w / 5} fill="none" {...base} />
        </g>
      );
    case "solar":
      return (
        <g>
          {body(0.02, "#2e4a70")}
          {Array.from({ length: Math.round(w / 1.5) - 1 }, (_, i) => (
            <path
              key={i}
              d={`M${x0 + (w / Math.round(w / 1.5)) * (i + 1)} ${y0}V${-y0}`}
              stroke="#9fb5d0"
              strokeWidth={sw}
            />
          ))}
        </g>
      );
    case "pergola":
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} {...overhead} />
          {Array.from({ length: Math.round(w / 1) - 1 }, (_, i) => (
            <path
              key={i}
              d={`M${x0 + i + 1} ${y0}V${-y0}`}
              stroke={S}
              strokeWidth={sw}
              strokeOpacity=".35"
            />
          ))}
        </g>
      );
    default:
      return body(0.06);
  }
}
