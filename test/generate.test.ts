import { generate } from "../lib";

jest.useFakeTimers();

it("matches snapshots", async () => {
  const generated = await generate("test", "test/generated");
  expect(generated).toMatchSnapshot();
});
