// Local test suite on ganache: Agent ID gating, stamp, check-in streaks, signals.
// Revert checks use staticCall so no state is touched and reasons come back cleanly.
const ganache = require("ganache");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", `${name}.json`), "utf8"));
}
let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log("  PASS", label); }
  else { failed++; console.log("  FAIL", label); }
}
function haystack(e) {
  return [e.message, e.shortMessage, e.reason, e.info && e.info.error && e.info.error.message, JSON.stringify(e.info || {})].join(" | ");
}
async function expectRevert(label, thunk, needle) {
  try { await thunk(); check(label, false); }
  catch (e) { check(label, haystack(e).includes(needle)); }
}

(async () => {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true } }));
  const accounts = await provider.listAccounts();
  const [deployer, alice, bob] = accounts; // alice = Agent ID holder, bob = non-holder

  const mockArt = artifact("MockAgentID");
  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer).deploy();
  await mock.waitForDeployment();

  const pulseArt = artifact("AgentPulse");
  const pulse = await new ethers.ContractFactory(pulseArt.abi, pulseArt.bytecode, deployer)
    .deploy(await mock.getAddress());
  await pulse.waitForDeployment();
  console.log("AgentPulse (test):", await pulse.getAddress());

  await mock.setHolder(alice.address, true);

  check("isAgent(alice) = true", (await pulse.isAgent(alice.address)) === true);
  check("isAgent(bob) = false", (await pulse.isAgent(bob.address)) === false);

  await expectRevert("non-holder cannot claim stamp", () => pulse.connect(bob).claimStamp.staticCall(), "Agent ID required");
  await expectRevert("check-in before stamp reverts", () => pulse.connect(alice).checkIn.staticCall(), "claim your stamp first");

  await (await pulse.connect(alice).claimStamp()).wait();
  let m = await pulse.memberOf(alice.address);
  check("stampId = 1", Number(m.stampId) === 1);
  check("points = 100 after claim", Number(m.points) === 100);
  check("totalMembers = 1", Number(await pulse.totalMembers()) === 1);
  await expectRevert("second stamp claim reverts", () => pulse.connect(alice).claimStamp.staticCall(), "stamp already claimed");

  await (await pulse.connect(alice).checkIn()).wait();
  m = await pulse.memberOf(alice.address);
  check("streak = 1 after first check-in", Number(m.streak) === 1);
  check("points = 111 after first check-in (100+10+1)", Number(m.points) === 111);
  await expectRevert("second check-in same day reverts", () => pulse.connect(alice).checkIn.staticCall(), "already checked in today");

  await (await pulse.connect(alice).postSignal("first pulse from an agent")).wait();
  check("lastSignal stored", (await pulse.lastSignal(alice.address)) === "first pulse from an agent");
  m = await pulse.memberOf(alice.address);
  check("points = 113 after first signal (+2)", Number(m.points) === 113);
  check("totalSignals = 1", Number(await pulse.totalSignals()) === 1);
  await expectRevert("empty signal reverts", () => pulse.connect(alice).postSignal.staticCall(""), "1-140 bytes");
  await expectRevert("overlong signal reverts", () => pulse.connect(alice).postSignal.staticCall("x".repeat(141)), "1-140 bytes");
  await expectRevert("non-holder cannot post signal", () => pulse.connect(bob).postSignal.staticCall("hi"), "Agent ID required");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
