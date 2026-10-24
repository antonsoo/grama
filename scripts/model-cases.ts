import { exactNotes, incoming, noteFactors, outgoing, sequence } from "../src/core/tuning";

for (const grama of ["sadja", "madhyama"] as const)
  for (const model of ["ratios", "equal"] as const)
    for (let start = 0; start < 7; start++) {
      console.log(
        JSON.stringify({
          grama,
          model,
          start,
          base: 220,
          incoming: incoming(grama),
          outgoing: outgoing(grama, start),
          ratios: exactNotes(grama),
          factors: noteFactors(grama, model),
          sequence: sequence({ grama, model, start, base: 220 }),
        }),
      );
    }
