import { describe, expect, it } from "vitest";
import { artSignature, lookFor } from "@/lib/creature-look";
import { seedCatalog } from "@/lib/seed";

describe("creature portraits", () => {
  it("gives every seeded creature a different picture", () => {
    const signatures = seedCatalog.creatures.map((creature) => artSignature(creature.name));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("keeps the same name stable and splits names that used to share a drawing", () => {
    expect(artSignature("River Dragon")).toBe(artSignature("River Dragon"));
    expect(artSignature("River Dragon")).not.toBe(artSignature("Cosmic Dragon"));
    expect(artSignature("Hare")).not.toBe(artSignature("Bunny"));
    expect(artSignature("Frost Sovereign")).not.toBe(artSignature("Moss Warden"));
    expect(artSignature("Inferno Lion")).not.toBe(artSignature("Lion"));
  });

  it("keeps a plain Chick, Bunny, and Cat on their original drawings", () => {
    expect(lookFor("Chick").classic).toBe(true);
    expect(lookFor("Bunny").classic).toBe(true);
    expect(lookFor("Cat").classic).toBe(true);
    expect(lookFor("River Dragon").classic).toBe(false);
    expect(lookFor("River Dragon").kind).toBe("dragon");
    expect(lookFor("Cosmic Dragon").extra).toBe("star");
    expect(lookFor("Inferno Lion").extra).toBe("flame");
  });
});
