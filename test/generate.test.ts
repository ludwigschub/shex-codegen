import { generate } from "../lib";

jest.useFakeTimers();

it.only("matches snapshots with config file", async () => {
  const generated = await generate();
  expect(generated).toMatchSnapshot();
});

it("matches snapshots without config file", async () => {
  const generated = await generate("test/shapes/solidProfile.shex", {
    "test/generated/withoutConfig.ts": ["typescript", "typescript-methods"],
  });
  expect(generated).toMatchSnapshot();
});
