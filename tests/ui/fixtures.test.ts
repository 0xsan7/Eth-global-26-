import { test } from "node:test";
import assert from "node:assert/strict";
import { devFixturesEnabled } from "../../src/lib/shared/fixtures";

test("fixtures require explicit opt-in and remain disabled in production", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  const previousFixtureFlag = env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES;
  try {
    env.NODE_ENV = "development";
    delete env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES;
    assert.equal(devFixturesEnabled(), false);
    env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES = "true";
    assert.equal(devFixturesEnabled(), true);
    env.NODE_ENV = "production";
    assert.equal(devFixturesEnabled(), false);
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
    if (previousFixtureFlag === undefined) delete env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES;
    else env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES = previousFixtureFlag;
  }
});
