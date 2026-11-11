import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureOpportunities } from "../../src/components/opportunities/opportunity-format";
import { resolveOpportunitySelection } from "../../src/components/opportunities/selection";

const rows = fixtureOpportunities();
const [first, second, third] = rows;
assert.ok(first && second && third);

test("defaults to the first opportunity when rows exist and no pick was made", () => {
  assert.equal(resolveOpportunitySelection(rows, null, false), first);
  assert.equal(resolveOpportunitySelection([], null, false), null);
});

test("keeps a deliberate pick when refreshed rows are reordered", () => {
  assert.equal(resolveOpportunitySelection([...rows].reverse(), second, false), second);
});

test("falls back to the first current row when a picked record disappears", () => {
  assert.equal(resolveOpportunitySelection([first, second], third, false), first);
});

test("an explicit dismissal suppresses the default detail while rows remain", () => {
  assert.equal(resolveOpportunitySelection(rows, null, true), null);
});

test("a deliberate selection reopens details after dismissal", () => {
  assert.equal(resolveOpportunitySelection(rows, second, false), second);
});
