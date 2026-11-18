// Compile AgentPulse.sol + MockAgentID.sol with solc (optimizer 200 runs).
// Writes build/<Name>.json with { abi, bytecode } — the standard JSON output
// is also kept in build/standard-output.json for BscScan verification.
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.join(__dirname, "..");
const sources = {};
for (const f of ["AgentPulse.sol", "MockAgentID.sol"]) {
  sources[f] = { content: fs.readFileSync(path.join(root, "contracts", f), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    evmVersion: "paris",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) {
  for (const e of out.errors) {
    console.log(e.severity.toUpperCase(), e.formattedMessage);
    if (e.severity === "error") process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(1);

fs.mkdirSync(path.join(root, "build"), { recursive: true });
fs.writeFileSync(path.join(root, "build", "standard-input.json"), JSON.stringify(input, null, 2));
for (const f of Object.keys(sources)) {
  for (const [name, c] of Object.entries(out.contracts[f])) {
    fs.writeFileSync(
      path.join(root, "build", `${name}.json`),
      JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object, deployedSize: c.evm.deployedBytecode.object.length / 2 }, null, 2)
    );
    console.log(name, "bytecode bytes:", c.evm.bytecode.object.length / 2, "deployed bytes:", c.evm.deployedBytecode.object.length / 2);
  }
}
console.log("solc version:", solc.version());
