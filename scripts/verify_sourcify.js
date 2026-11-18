// Verify AgentPulse on Sourcify (chain 56) using the standard JSON input.
const fs = require("fs");
const path = require("path");
(async () => {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8"));
  const stdInput = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "build", "standard-input.json"), "utf8"));
  const body = {
    stdJsonInput: stdInput,
    compilerVersion: "0.8.38+commit.1835d247",
    contractIdentifier: "AgentPulse.sol:AgentPulse",
    creatorTxHash: dep.deployTx,
  };
  const res = await fetch("https://sourcify.dev/server/v2/verify/56/" + dep.contract, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("HTTP", res.status);
  console.log(JSON.stringify(await res.json(), null, 2).slice(0, 2000));
})();
