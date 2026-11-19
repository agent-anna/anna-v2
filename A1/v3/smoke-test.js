/**
 * ANNA V3 — Smoke Test
 * Verifies all core module exports and their methods exist.
 * Zero writes. Pure read-only validation.
 */

const smokeTest = (() => {
  const results = [];

  const pass = (msg) => {
    console.log(`✅ PASS: ${msg}`);
    results.push({ status: "pass", msg });
  };

  const fail = (msg) => {
    console.error(`❌ FAIL: ${msg}`);
    results.push({ status: "fail", msg });
  };

  const assertFn = (name, obj, fn) => {
    if (obj && typeof obj[fn] === "function") {
      pass(`${name}.${fn}`);
    } else {
      fail(`${name}.${fn} — not found or not a function`);
    }
  };

  const assertObj = (name, obj) => {
    if (obj && typeof obj === "object") {
      pass(`${name} object exists`);
    } else {
      fail(`${name} — module not found`);
    }
  };

  // ── Verify Utils ──────────────────────────────────────────
  const verifyUtils = () => {
    assertObj("Utils", typeof Utils !== "undefined" ? Utils : null);
    assertFn("Utils", { safeParse: typeof Utils !== "undefined" ? Utils.safeParse : null }, "safeParse");
  };

  // ── Verify GitHub ─────────────────────────────────────────
  const verifyGitHub = () => {
    assertObj("GitHub", typeof GitHub !== "undefined" ? GitHub : null);
    assertFn("GitHub", { get: typeof GitHub !== "undefined" ? GitHub.get : null }, "get");
    assertFn("GitHub", { configure: typeof GitHub !== "undefined" ? GitHub.configure : null }, "configure");
  };

  // ── Verify Memory ──────────────────────────────────────────
  const verifyMemory = () => {
    assertObj("Memory", typeof Memory !== "undefined" ? Memory : null);
    assertFn("Memory", { loadAll: typeof Memory !== "undefined" ? Memory.loadAll : null }, "loadAll");
    assertFn("Memory", { load: typeof Memory !== "undefined" ? Memory.load : null }, "load");
    assertFn("Memory", { addNote: typeof Memory !== "undefined" ? Memory.addNote : null }, "addNote");
    assertFn("Memory", { addLink: typeof Memory !== "undefined" ? Memory.addLink : null }, "addLink");
  };

  // ── Verify Telemetry ───────────────────────────────────────
  const verifyTelemetry = () => {
    assertObj("Telemetry", typeof Telemetry !== "undefined" ? Telemetry : null);
    assertFn("Telemetry", { getCryptoPrices: typeof Telemetry !== "undefined" ? Telemetry.getCryptoPrices : null }, "getCryptoPrices");
    assertFn("Telemetry", { searchWeb: typeof Telemetry !== "undefined" ? Telemetry.searchWeb : null }, "searchWeb");
    assertFn("Telemetry", { fetchUrl: typeof Telemetry !== "undefined" ? Telemetry.fetchUrl : null }, "fetchUrl");
  };

  // ── Verify Brain ──────────────────────────────────────────
  const verifyBrain = () => {
    assertObj("Brain", typeof Brain !== "undefined" ? Brain : null);
    assertFn("Brain", { load: typeof Brain !== "undefined" ? Brain.load : null }, "load");
    assertFn("Brain", { getSummary: typeof Brain !== "undefined" ? Brain.getSummary : null }, "getSummary");
  };

  // ── Verify Chat ───────────────────────────────────────────
  const verifyChat = () => {
    assertObj("Chat", typeof Chat !== "undefined" ? Chat : null);
    assertFn("Chat", { send: typeof Chat !== "undefined" ? Chat.send : null }, "send");
  };

  // ── Run All Verifications ─────────────────────────────────
  const verifyModules = () => {
    console.log("\n🧪 ANNA V3 — Smoke Test\n" + "─".repeat(40));
    verifyUtils();
    verifyGitHub();
    verifyMemory();
    verifyTelemetry();
    verifyBrain();
    verifyChat();
    console.log("─".repeat(40));
  };

  // ── Live Functional Test ──────────────────────────────────
  const runLiveTests = async ({ githubConfig } = {}) => {
    console.log("\n🚀 Running Live Tests...\n" + "─".repeat(40));

    // Configure GitHub if config provided
    if (githubConfig && typeof GitHub !== "undefined" && GitHub.configure) {
      try {
        GitHub.configure(githubConfig);
        pass("GitHub.configure() applied");
      } catch (e) {
        fail(`GitHub.configure() — ${e.message}`);
      }
    }

    // Test Brain.load()
    if (typeof Brain !== "undefined" && Brain.load) {
      try {
        await Brain.load();
        pass("Brain.load() completed");
      } catch (e) {
        fail(`Brain.load() — ${e.message}`);
      }
    } else {
      fail("Brain.load() — not available");
    }

    // Test Memory.loadAll()
    if (typeof Memory !== "undefined" && Memory.loadAll) {
      try {
        await Memory.loadAll();
        pass("Memory.loadAll() completed");
      } catch (e) {
        fail(`Memory.loadAll() — ${e.message}`);
      }
    } else {
      fail("Memory.loadAll() — not available");
    }

    // Test Telemetry.getCryptoPrices()
    if (typeof Telemetry !== "undefined" && Telemetry.getCryptoPrices) {
      try {
        const prices = await Telemetry.getCryptoPrices();
        if (prices && prices.bitcoin && prices.dogecoin) {
          pass(`Telemetry.getCryptoPrices() — BTC: $${prices.bitcoin.usd} | DOGE: $${prices.dogecoin.usd}`);
        } else {
          fail("Telemetry.getCryptoPrices() — unexpected response shape");
        }
      } catch (e) {
        fail(`Telemetry.getCryptoPrices() — ${e.message}`);
      }
    } else {
      fail("Telemetry.getCryptoPrices() — not available");
    }

    console.log("─".repeat(40));
  };

  // ── Summary Report ─────────────────────────────────────────
  const getReport = () => {
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    console.log(`\n📊 Smoke Test Summary: ${passed} passed, ${failed} failed`);
    return { passed, failed, results };
  };

  return {
    runSmokeTest: async ({ githubConfig } = {}) => {
      results.length = 0;
      verifyModules();
      await runLiveTests({ githubConfig });
      return getReport();
    },
    verifyModules,
    getReport,
  };
})();

// Export for module environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = smokeTest;
}
