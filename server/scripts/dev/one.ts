import { DEMOS } from "@shared/design/demos";
DEMOS.find((d) => d.id === (process.argv[2] ?? "modern-family-villa"))!.build();
